import { randomUUID } from 'node:crypto';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeCustomerQuotationHistoryFilters,
  type CustomerQuotationHistoryFilterInput,
} from '@ertip/reporting';

import { getDemoCustomerQuotationHistoryReport } from '@/lib/demo-report';
import { getCustomerQuotationHistoryReport } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readFilterInput(
  customerId: string,
  searchParams: URLSearchParams,
): CustomerQuotationHistoryFilterInput {
  return {
    businessUnitId: searchParams.get('businessUnitId'),
    customerId,
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    salespersonId: searchParams.get('salespersonId'),
    status: searchParams.get('status'),
  };
}

function errorResponse(error: string, status: number, requestId: string): Response {
  return Response.json(
    { ok: false, error, requestId },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
  );
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly customerId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { customerId } = await context.params;
  if (!/^\d+$/u.test(customerId)) {
    return errorResponse('CUSTOMER_REQUIRED', 400, requestId);
  }

  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  const session = runtime.demoMode ? null : await getCurrentSession();
  if (!runtime.demoMode && !session) {
    return errorResponse('AUTHENTICATION_REQUIRED', 401, requestId);
  }
  if (session && !can(session.role, 'reports:read')) {
    return errorResponse('REPORT_ACCESS_DENIED', 403, requestId);
  }

  const allowedBusinessUnitIds = session?.allowedBusinessUnitIds ?? [INTERNATIONAL_BUSINESS_UNIT_ID];
  const url = new URL(request.url);

  try {
    const filters = normalizeCustomerQuotationHistoryFilters({
      request: readFilterInput(customerId, url.searchParams),
      allowedBusinessUnitIds,
      now: generatedAt,
    });
    const result = runtime.demoMode
      ? getDemoCustomerQuotationHistoryReport(filters, generatedAt)
      : await getCustomerQuotationHistoryReport({
          filters,
          allowedBusinessUnitIds,
          generatedAt,
          timelineLimit: 500,
        });

    return Response.json(
      { ok: true, requestId, result },
      { headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'REPORT_SCOPE_EMPTY' || message === 'REPORT_SCOPE_DENIED') {
      return errorResponse('REPORT_SCOPE_DENIED', 403, requestId);
    }
    if (message === 'REPORT_CUSTOMER_UNAVAILABLE') {
      return errorResponse('REPORT_CUSTOMER_UNAVAILABLE', 404, requestId);
    }
    if (message === 'INVALID_REPORT_RANGE' || message === 'INVALID_REPORT_DATE') {
      return errorResponse(message, 400, requestId);
    }
    console.error('[report-api] customer quotation history failed', {
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return errorResponse('REPORT_FAILED', 500, requestId);
  }
}
