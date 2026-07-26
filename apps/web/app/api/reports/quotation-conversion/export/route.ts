import { randomUUID } from 'node:crypto';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeQuotationConversionFilters,
  type QuotationConversionFilterInput,
} from '@ertip/reporting';

import { getAppDatabase } from '@/lib/database';
import { getDemoQuotationConversionReport } from '@/lib/quotation-conversion-demo';
import {
  buildQuotationConversionXlsx,
  createQuotationConversionExportFilename,
} from '@/lib/quotation-conversion-report-export';
import { getQuotationConversionReport } from '@/lib/quotation-conversion-reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readFilterInput(searchParams: URLSearchParams): QuotationConversionFilterInput {
  return {
    businessUnitId: searchParams.get('businessUnitId'),
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    salespersonId: searchParams.get('salespersonId'),
    customerId: searchParams.get('customerId'),
  };
}

function errorResponse(error: string, status: number, requestId: string): Response {
  return Response.json(
    { ok: false, error, requestId },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(request.url);
  if (url.searchParams.get('format') !== 'xlsx') {
    return errorResponse('UNSUPPORTED_EXPORT_FORMAT', 400, requestId);
  }

  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  const session = runtime.demoMode ? null : await getCurrentSession();
  if (!runtime.demoMode && !session) return errorResponse('AUTHENTICATION_REQUIRED', 401, requestId);
  if (session && !can(session.role, 'reports:export')) {
    return errorResponse('REPORT_EXPORT_ACCESS_DENIED', 403, requestId);
  }

  const allowedBusinessUnitIds = session?.allowedBusinessUnitIds ?? [INTERNATIONAL_BUSINESS_UNIT_ID];
  try {
    const filters = normalizeQuotationConversionFilters({
      request: readFilterInput(url.searchParams),
      allowedBusinessUnitIds,
      now: generatedAt,
    });
    const report = runtime.demoMode
      ? getDemoQuotationConversionReport(filters, generatedAt)
      : await getQuotationConversionReport({
          filters,
          allowedBusinessUnitIds,
          generatedAt,
          detailLimit: 10_000,
        });
    const buffer = await buildQuotationConversionXlsx(report);
    const filename = createQuotationConversionExportFilename(report);

    if (session) {
      const database = await getAppDatabase();
      await database.recordAudit({
        actorUserId: session.id,
        action: 'report.export.xlsx',
        entityType: 'report_definition',
        entityId: report.definition.code,
        businessUnitScope: filters.businessUnitId,
        metadata: {
          requestId,
          reportVersion: report.definition.version,
          metricVersion: report.definition.metricVersion,
          salespersonId: filters.salespersonId,
          customerId: filters.customerId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          format: 'xlsx',
          scope: 'filtered',
          detailCount: report.detailTotalCount,
          anomalyCount: report.anomalies.totalCount,
        },
      });
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'REPORT_SCOPE_EMPTY' || message === 'REPORT_SCOPE_DENIED') {
      return errorResponse('REPORT_SCOPE_DENIED', 403, requestId);
    }
    if (message === 'INVALID_REPORT_RANGE' || message === 'INVALID_REPORT_DATE') {
      return errorResponse(message, 400, requestId);
    }
    console.error('[report-export] quotation conversion generation failed', {
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return errorResponse('REPORT_EXPORT_FAILED', 500, requestId);
  }
}
