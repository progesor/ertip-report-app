import { NextResponse } from 'next/server';

import { readRuntimeConfig } from '@ertip/config';
import { createOdooClient, OdooClientError, type OdooVersionInfo } from '@ertip/odoo-client';

import { getAppDatabase } from '@/lib/database';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OdooTestStage = 'version' | 'json2';

function readServerVersion(versionInfo: OdooVersionInfo): string {
  return (
    versionInfo.version ??
    versionInfo.server_version ??
    versionInfo.server_serie ??
    'Bilinmeyen sürüm'
  );
}

function createSafeErrorCode(stage: OdooTestStage, error: OdooClientError): string {
  return `${stage.toUpperCase()}_${error.code}`;
}

function getSafeErrorMessage(code: string): string {
  const messages: Readonly<Record<string, string>> = {
    VERSION_TIMEOUT: 'Odoo sürüm servisi zaman aşımına uğradı.',
    VERSION_NETWORK_ERROR: 'Odoo sunucusunun sürüm servisine ulaşılamadı.',
    VERSION_ENDPOINT_NOT_FOUND: 'Odoo 19 sürüm servisi bulunamadı.',
    VERSION_ODOO_UNAVAILABLE: 'Odoo sürüm servisi geçici olarak kullanılamıyor.',
    JSON2_TIMEOUT: 'Odoo JSON-2 isteği zaman aşımına uğradı.',
    JSON2_NETWORK_ERROR: 'Odoo JSON-2 servisine ağ üzerinden ulaşılamadı.',
    JSON2_AUTHENTICATION_FAILED: 'Odoo API anahtarı reddedildi.',
    JSON2_ACCESS_DENIED: 'API kullanıcısının şirket bilgilerini okuma yetkisi yok.',
    JSON2_ENDPOINT_NOT_FOUND: 'Odoo JSON-2 endpoint’i bulunamadı.',
    JSON2_REQUEST_REJECTED: 'Odoo JSON-2 isteği geçersiz bulundu.',
    JSON2_RATE_LIMITED: 'Odoo istek sınırı aşıldı; kısa süre sonra tekrar deneyin.',
    JSON2_ODOO_UNAVAILABLE: 'Odoo JSON-2 servisi geçici olarak kullanılamıyor.',
  };

  return messages[code] ?? 'Odoo bağlantı testi başarısız.';
}

async function recordFailure(options: {
  readonly checkedBy: string;
  readonly safeErrorCode: string;
  readonly durationMs: number;
  readonly stage: OdooTestStage;
  readonly upstreamStatus: number | null;
}): Promise<void> {
  try {
    const database = await getAppDatabase();
    await database.recordOdooConnectionCheck({
      checkedBy: options.checkedBy,
      status: 'failure',
      serverVersion: null,
      companyCount: null,
      durationMs: options.durationMs,
      safeErrorCode: options.safeErrorCode,
    });
    await database.recordAudit({
      actorUserId: options.checkedBy,
      action: 'odoo.connection.test.failed',
      entityType: 'odoo_connection',
      metadata: {
        safeErrorCode: options.safeErrorCode,
        durationMs: options.durationMs,
        stage: options.stage,
        upstreamStatus: options.upstreamStatus,
      },
    });
  } catch (auditError) {
    console.error('[odoo] failed to record connection test', {
      name: auditError instanceof Error ? auditError.name : 'UnknownError',
    });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  let stage: OdooTestStage = 'version';

  try {
    assertSameOrigin(request);
    const user = await requirePermission('admin:connections');
    const runtimeConfig = readRuntimeConfig();

    if (
      !runtimeConfig.odoo.configured ||
      !runtimeConfig.odoo.baseUrl ||
      !runtimeConfig.odoo.database ||
      !runtimeConfig.odoo.apiKey
    ) {
      return NextResponse.json(
        { ok: false, error: 'Odoo bağlantı bilgileri runtime ortamında tamamlanmamış.' },
        { status: 503 },
      );
    }

    const client = createOdooClient({
      baseUrl: runtimeConfig.odoo.baseUrl,
      database: runtimeConfig.odoo.database,
      apiKey: runtimeConfig.odoo.apiKey,
      timeoutMs: runtimeConfig.odoo.timeoutMs,
    });

    const versionInfo = await client.getVersionInfo();
    stage = 'json2';
    const companyCount = await client.call<number>('res.company', 'search_count', { domain: [] });
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const serverVersion = readServerVersion(versionInfo);

    try {
      const database = await getAppDatabase();
      await database.recordOdooConnectionCheck({
        checkedBy: user.id,
        status: 'success',
        serverVersion,
        companyCount,
        durationMs,
        safeErrorCode: null,
      });
      await database.recordAudit({
        actorUserId: user.id,
        action: 'odoo.connection.test.succeeded',
        entityType: 'odoo_connection',
        metadata: { serverVersion, companyCount, durationMs },
      });
    } catch (auditError) {
      console.error('[odoo] failed to record successful connection test', {
        name: auditError instanceof Error ? auditError.name : 'UnknownError',
      });
    }

    return NextResponse.json({
      ok: true,
      result: {
        serverVersion,
        companyCount,
        durationMs,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    if (error instanceof OdooClientError) {
      const user = await requirePermission('admin:connections');
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const safeErrorCode = createSafeErrorCode(stage, error);
      const upstreamStatus = error.status ?? null;

      await recordFailure({
        checkedBy: user.id,
        safeErrorCode,
        durationMs,
        stage,
        upstreamStatus,
      });

      console.error('[odoo] connection test failed', {
        safeErrorCode,
        stage,
        upstreamStatus,
      });

      // Operational upstream failures intentionally use HTTP 200 so reverse proxies such as
      // Cloudflare do not replace the structured diagnostic JSON with a generic 502 page.
      return NextResponse.json({
        ok: false,
        error: getSafeErrorMessage(safeErrorCode),
        code: safeErrorCode,
        stage,
        upstreamStatus,
      });
    }

    console.error('[odoo] connection test failed unexpectedly', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Odoo bağlantı testi beklenmeyen bir nedenle tamamlanamadı.' },
      { status: 500 },
    );
  }
}
