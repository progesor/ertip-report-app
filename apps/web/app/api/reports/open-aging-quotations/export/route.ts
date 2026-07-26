import { randomUUID } from 'node:crypto';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeOpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportFilterInput,
} from '@ertip/reporting';

import { getAppDatabase } from '@/lib/database';
import { getDemoOpenAgingQuotationReport } from '@/lib/demo-report';
import { createOpenAgingExportFilename } from '@/lib/open-aging-report-export';
import { getOpenAgingQuotationReport } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';
import { buildOpenAgingQuotationXlsxWithAmounts } from '@/lib/source-currency-report-export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readFilterInput(searchParams: URLSearchParams): OpenAgingQuotationReportFilterInput {
  return {
    businessUnitId: searchParams.get('businessUnitId'),
    salespersonId: searchParams.get('salespersonId'),
    customerId: searchParams.get('customerId'),
    ageBucket: searchParams.get('ageBucket'),
    validityGroup: searchParams.get('validityGroup'),
  };
}

function createErrorResponse(error: string, status: number, requestId: string): Response {
  return Response.json(
    { ok: false, error, requestId },
    {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    },
  );
}

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(request.url);

  if (url.searchParams.get('format') !== 'xlsx') {
    return createErrorResponse('UNSUPPORTED_EXPORT_FORMAT', 400, requestId);
  }

  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  const session = runtime.demoMode ? null : await getCurrentSession();

  if (!runtime.demoMode && !session) {
    return createErrorResponse('AUTHENTICATION_REQUIRED', 401, requestId);
  }

  if (session && !can(session.role, 'reports:export')) {
    return createErrorResponse('REPORT_EXPORT_ACCESS_DENIED', 403, requestId);
  }

  const allowedBusinessUnitIds = session?.allowedBusinessUnitIds ?? [INTERNATIONAL_BUSINESS_UNIT_ID];

  try {
    const filters = normalizeOpenAgingQuotationReportFilters({
      request: readFilterInput(url.searchParams),
      allowedBusinessUnitIds,
    });
    const report = runtime.demoMode
      ? getDemoOpenAgingQuotationReport(filters, generatedAt, 100_000)
      : await getOpenAgingQuotationReport({
          filters,
          allowedBusinessUnitIds,
          generatedAt,
          detailLimit: 100_000,
        });
    const buffer = await buildOpenAgingQuotationXlsxWithAmounts(report);
    const filename = createOpenAgingExportFilename(report);

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
          asOfDate: report.asOfDate,
          salespersonId: filters.salespersonId,
          customerId: filters.customerId,
          ageBucket: filters.ageBucket,
          validityGroup: filters.validityGroup,
          format: 'xlsx',
          scope: 'filtered',
          detailCount: report.detailTotalCount,
          currencyCodes: report.amounts.map(({ currencyCode }) => currencyCode),
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
    console.error('[report-export] open aging generation failed', {
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    const message = error instanceof Error ? error.message : '';

    if (message === 'REPORT_SCOPE_EMPTY' || message === 'REPORT_SCOPE_DENIED') {
      return createErrorResponse('REPORT_SCOPE_DENIED', 403, requestId);
    }

    return createErrorResponse('REPORT_EXPORT_FAILED', 500, requestId);
  }
}
