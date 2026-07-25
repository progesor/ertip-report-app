import { NextResponse } from 'next/server';

import { readRuntimeConfig } from '@ertip/config';
import {
  createOdooClient,
  discoverSaleOrderCoverage,
  OdooClientError,
} from '@ertip/odoo-client';

import { getAppDatabase } from '@/lib/database';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function getSafeCoverageErrorMessage(code: string): string {
  const messages: Readonly<Record<string, string>> = {
    COVERAGE_TIMEOUT: 'Şirket kapsamı sorgusu zaman aşımına uğradı.',
    COVERAGE_NETWORK_ERROR: 'Şirket kapsamı sorgusunda Odoo sunucusuna ulaşılamadı.',
    COVERAGE_AUTHENTICATION_FAILED: 'Odoo API anahtarı reddedildi.',
    COVERAGE_ACCESS_DENIED: 'Entegrasyon kullanıcısının kapsam verilerini okuma yetkisi yok.',
    COVERAGE_ENDPOINT_NOT_FOUND: 'Gerekli Odoo JSON-2 endpoint’i bulunamadı.',
    COVERAGE_REQUEST_REJECTED: 'Şirket kapsamı sorgusu Odoo tarafından reddedildi.',
    COVERAGE_RATE_LIMITED: 'Odoo istek sınırı aşıldı; sorguyu daha sonra yeniden çalıştırın.',
    COVERAGE_ODOO_UNAVAILABLE: 'Odoo kapsam servisi geçici olarak kullanılamıyor.',
    COVERAGE_COMPANY_COVERAGE_UNAVAILABLE: 'Erişilebilir şirket kayıtları okunamadı.',
  };

  return messages[code] ?? 'Şirket kapsamı ve veri kalite sorgusu tamamlanamadı.';
}

export async function GET() {
  const startedAt = performance.now();
  let actorUserId: string | null = null;

  try {
    const user = await requirePermission('admin:data-quality');
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
    const result = await discoverSaleOrderCoverage(client);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    try {
      const database = await getAppDatabase();
      await database.recordAudit({
        actorUserId: user.id,
        action: 'odoo.sale-order.coverage.completed',
        entityType: 'odoo_connection',
        metadata: {
          totalCount: result.totalCount,
          globalReconcilesTotal: result.reconcilesTotal,
          missingSalespersonCount: result.missingSalespersonCount,
          companyCoverage: result.companyCoverage.map((company) => ({
            companyId: company.companyId,
            totalCount: company.totalCount,
            missingSalespersonCount: company.missingSalespersonCount,
            reconcilesTotal: company.reconcilesTotal,
          })),
          durationMs,
        },
      });
    } catch (auditError) {
      console.error('[odoo] failed to record sale order coverage success', {
        name: auditError instanceof Error ? auditError.name : 'UnknownError',
      });
    }

    return NextResponse.json(
      { ok: true, result, durationMs },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    if (error instanceof OdooClientError) {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const safeErrorCode = `COVERAGE_${error.code}`;
      const upstreamStatus = error.status ?? null;

      if (actorUserId) {
        try {
          const database = await getAppDatabase();
          await database.recordAudit({
            actorUserId,
            action: 'odoo.sale-order.coverage.failed',
            entityType: 'odoo_connection',
            metadata: { safeErrorCode, upstreamStatus, durationMs },
          });
        } catch (auditError) {
          console.error('[odoo] failed to record sale order coverage failure', {
            name: auditError instanceof Error ? auditError.name : 'UnknownError',
          });
        }
      }

      console.error('[odoo] sale order coverage failed', { safeErrorCode, upstreamStatus });
      return NextResponse.json({
        ok: false,
        error: getSafeCoverageErrorMessage(safeErrorCode),
        code: safeErrorCode,
        upstreamStatus,
        durationMs,
      });
    }

    console.error('[odoo] sale order coverage failed unexpectedly', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Şirket kapsamı sorgusu beklenmeyen bir nedenle tamamlanamadı.' },
      { status: 500 },
    );
  }
}
