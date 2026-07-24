import { NextResponse } from 'next/server';

import { readRuntimeConfig } from '@ertip/config';
import { createOdooClient, OdooClientError } from '@ertip/odoo-client';

import { getAppDatabase } from '@/lib/database';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let checkedBy: string | null = null;
  const startedAt = performance.now();

  try {
    assertSameOrigin(request);
    const user = await requirePermission('admin:connections');
    checkedBy = user.id;
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
    const [versionInfo, companyCount] = await Promise.all([
      client.getVersionInfo(),
      client.call<number>('res.company', 'search_count', { domain: [] }),
    ]);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const serverVersion =
      versionInfo.server_version ?? versionInfo.server_serie ?? 'Bilinmeyen sürüm';
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

    const safeErrorCode = error instanceof OdooClientError ? error.code : 'ODOO_TEST_FAILED';
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    if (checkedBy) {
      try {
        const database = await getAppDatabase();
        await database.recordOdooConnectionCheck({
          checkedBy,
          status: 'failure',
          serverVersion: null,
          companyCount: null,
          durationMs,
          safeErrorCode,
        });
        await database.recordAudit({
          actorUserId: checkedBy,
          action: 'odoo.connection.test.failed',
          entityType: 'odoo_connection',
          metadata: { safeErrorCode, durationMs },
        });
      } catch (auditError) {
        console.error('[odoo] failed to record connection test', {
          name: auditError instanceof Error ? auditError.name : 'UnknownError',
        });
      }
    }

    console.error('[odoo] connection test failed', { safeErrorCode });
    return NextResponse.json(
      { ok: false, error: 'Odoo bağlantı testi başarısız.', code: safeErrorCode },
      { status: 502 },
    );
  }
}
