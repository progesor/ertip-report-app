import { randomUUID } from 'node:crypto';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
  type MonthlyQuotationReportFilterInput,
} from '@ertip/reporting';

import { getAppDatabase } from '@/lib/database';
import { getDemoMonthlyQuotationReport } from '@/lib/demo-report';
import {
  buildMonthlyQuotationPdf,
  buildMonthlyQuotationXlsx,
  createMonthlyQuotationExportFilename,
  withCompleteMonthlyQuotationDetails,
  type MonthlyQuotationPdfScope,
} from '@/lib/report-export';
import {
  getMonthlyQuotationExportDetails,
  getMonthlyQuotationReport,
} from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readFilterInput(
  searchParams: URLSearchParams,
  overrides: { readonly clearDimensions?: boolean } = {},
): MonthlyQuotationReportFilterInput {
  return {
    businessUnitId: searchParams.get('businessUnitId'),
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    salespersonId: overrides.clearDimensions ? null : searchParams.get('salespersonId'),
    customerId: overrides.clearDimensions ? null : searchParams.get('customerId'),
    status: searchParams.get('status'),
    view: searchParams.get('view'),
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

function getPdfScope(value: string | null): MonthlyQuotationPdfScope | null {
  return value === 'all' || value === 'salesperson' ? value : null;
}

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  const pdfScope = getPdfScope(url.searchParams.get('scope'));

  if (format !== 'xlsx' && format !== 'pdf') {
    return createErrorResponse('UNSUPPORTED_EXPORT_FORMAT', 400, requestId);
  }

  if (format === 'pdf' && pdfScope === null) {
    return createErrorResponse('INVALID_PDF_SCOPE', 400, requestId);
  }

  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  let user:
    | {
        readonly userId: string;
        readonly role: 'owner' | 'manager';
        readonly allowedBusinessUnitIds: readonly string[];
      }
    | null = null;
  const allowedBusinessUnitIds = runtime.demoMode
    ? [INTERNATIONAL_BUSINESS_UNIT_ID]
    : (await getCurrentSession())?.allowedBusinessUnitIds ?? [];

  if (!runtime.demoMode) {
    const session = await getCurrentSession();

    if (!session) {
      return createErrorResponse('AUTHENTICATION_REQUIRED', 401, requestId);
    }

    if (!can(session.role, 'reports:read')) {
      return createErrorResponse('REPORT_ACCESS_DENIED', 403, requestId);
    }

    user = {
      userId: session.userId,
      role: session.role,
      allowedBusinessUnitIds: session.allowedBusinessUnitIds,
    };
  }

  try {
    const filters = normalizeMonthlyQuotationReportFilters({
      request: readFilterInput(url.searchParams, {
        clearDimensions: format === 'pdf' && pdfScope === 'all',
      }),
      allowedBusinessUnitIds: user?.allowedBusinessUnitIds ?? allowedBusinessUnitIds,
      now: generatedAt,
    });

    if (format === 'pdf' && pdfScope === 'salesperson' && filters.salespersonId === null) {
      return createErrorResponse('SALESPERSON_REQUIRED', 400, requestId);
    }

    const report = runtime.demoMode
      ? getDemoMonthlyQuotationReport(filters, generatedAt)
      : await getMonthlyQuotationReport({
          filters,
          allowedBusinessUnitIds: user?.allowedBusinessUnitIds ?? allowedBusinessUnitIds,
          generatedAt,
          detailLimit: 1_000,
        });
    const details = runtime.demoMode
      ? report.details
      : await getMonthlyQuotationExportDetails({
          filters,
          allowedBusinessUnitIds: user?.allowedBusinessUnitIds ?? allowedBusinessUnitIds,
          generatedAt,
        });
    const completeReport = withCompleteMonthlyQuotationDetails(report, details);
    const buffer =
      format === 'xlsx'
        ? await buildMonthlyQuotationXlsx(completeReport)
        : await buildMonthlyQuotationPdf({
            report: completeReport,
            scope: pdfScope ?? 'all',
          });
    const filename = createMonthlyQuotationExportFilename({
      report: completeReport,
      extension: format,
      ...(format === 'pdf' && pdfScope !== null ? { scope: pdfScope } : {}),
    });

    if (user) {
      const database = await getAppDatabase();
      await database.recordAudit({
        actorUserId: user.userId,
        action: `report.export.${format}`,
        entityType: 'report_definition',
        entityId: completeReport.definition.code,
        businessUnitScope: filters.businessUnitId,
        metadata: {
          requestId,
          reportVersion: completeReport.definition.version,
          metricVersion: completeReport.definition.metricVersion,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          status: filters.status,
          salespersonId: filters.salespersonId,
          customerId: filters.customerId,
          format,
          scope: format === 'pdf' ? pdfScope : 'filtered',
          detailCount: completeReport.detailTotalCount,
        },
      });
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'Content-Type':
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    console.error('[report-export] generation failed', {
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    const message = error instanceof Error ? error.message : '';

    if (message === 'REPORT_SCOPE_EMPTY' || message === 'REPORT_SCOPE_DENIED') {
      return createErrorResponse('REPORT_SCOPE_DENIED', 403, requestId);
    }

    if (message === 'INVALID_REPORT_RANGE' || message === 'INVALID_REPORT_DATE') {
      return createErrorResponse(message, 400, requestId);
    }

    return createErrorResponse('REPORT_EXPORT_FAILED', 500, requestId);
  }
}
