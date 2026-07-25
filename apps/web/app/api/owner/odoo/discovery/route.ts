import { NextResponse } from 'next/server';

import { readRuntimeConfig } from '@ertip/config';
import { createOdooClient, discoverOdooTenant, OdooClientError } from '@ertip/odoo-client';

import { getAppDatabase } from '@/lib/database';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function getSafeDiscoveryErrorMessage(code: string): string {
  const messages: Readonly<Record<string, string>> = {
    DISCOVERY_TIMEOUT: 'Odoo tenant keşfi zaman aşımına uğradı.',
    DISCOVERY_NETWORK_ERROR: 'Odoo tenant keşfi sırasında sunucuya ulaşılamadı.',
    DISCOVERY_AUTHENTICATION_FAILED: 'Odoo API anahtarı reddedildi.',
    DISCOVERY_ACCESS_DENIED: 'Entegrasyon kullanıcısının gerekli Odoo kayıtlarını okuma yetkisi yok.',
    DISCOVERY_ENDPOINT_NOT_FOUND: 'Gerekli Odoo JSON-2 endpoint’i bulunamadı.',
    DISCOVERY_REQUEST_REJECTED: 'Odoo tenant keşif isteği geçersiz bulundu.',
    DISCOVERY_RATE_LIMITED: 'Odoo istek sınırı aşıldı; kısa süre sonra tekrar deneyin.',
    DISCOVERY_ODOO_UNAVAILABLE: 'Odoo tenant keşif servisi geçici olarak kullanılamıyor.',
  };

  return messages[code] ?? 'Odoo tenant keşfi tamamlanamadı.';
}

async function recordDiscoveryFailure(options: {
  readonly actorUserId: string;
  readonly safeErrorCode: string;
  readonly durationMs: number;
  readonly upstreamStatus: number | null;
}): Promise<void> {
  try {
    const database = await getAppDatabase();
    await database.recordAudit({
      actorUserId: options.actorUserId,
      action: 'odoo.tenant.discovery.failed',
      entityType: 'odoo_connection',
      metadata: {
        safeErrorCode: options.safeErrorCode,
        durationMs: options.durationMs,
        upstreamStatus: options.upstreamStatus,
      },
    });
  } catch (auditError) {
    console.error('[odoo] failed to record tenant discovery failure', {
      name: auditError instanceof Error ? auditError.name : 'UnknownError',
    });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  let actorUserId: string | null = null;

  try {
    assertSameOrigin(request);
    const user = await requirePermission('admin:connections');
    actorUserId = user.id;
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
    const result = await discoverOdooTenant(client);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    try {
      const database = await getAppDatabase();
      await database.recordAudit({
        actorUserId: user.id,
        action: 'odoo.tenant.discovery.completed',
        entityType: 'odoo_connection',
        metadata: {
          serverVersion: result.serverVersion,
          companyCount: result.companies.length,
          accessibleCompanyIds: result.accessibleCompanyIds,
          multiCompanyReadable: result.multiCompanyReadable,
          saleOrderCount: result.saleOrder.totalCount,
          saleOrderCustomFieldCount: result.saleOrder.customFieldCount,
          cohortFieldRecommendation: result.saleOrder.dateSemantics.recommendedCohortField,
          durationMs,
        },
      });
    } catch (auditError) {
      console.error('[odoo] failed to record tenant discovery success', {
        name: auditError instanceof Error ? auditError.name : 'UnknownError',
      });
    }

    return NextResponse.json({
      ok: true,
      result,
      durationMs,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    if (error instanceof OdooClientError) {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const safeErrorCode = `DISCOVERY_${error.code}`;
      const upstreamStatus = error.status ?? null;

      if (actorUserId) {
        await recordDiscoveryFailure({
          actorUserId,
          safeErrorCode,
          durationMs,
          upstreamStatus,
        });
      }

      console.error('[odoo] tenant discovery failed', {
        safeErrorCode,
        upstreamStatus,
      });

      return NextResponse.json({
        ok: false,
        error: getSafeDiscoveryErrorMessage(safeErrorCode),
        code: safeErrorCode,
        upstreamStatus,
      });
    }

    console.error('[odoo] tenant discovery failed unexpectedly', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Odoo tenant keşfi beklenmeyen bir nedenle tamamlanamadı.' },
      { status: 500 },
    );
  }
}
