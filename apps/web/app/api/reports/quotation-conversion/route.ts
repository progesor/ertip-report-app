import { randomUUID } from 'node:crypto';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeQuotationConversionFilters,
  type QuotationConversionFilterInput,
} from '@ertip/reporting';

import { getDemoQuotationConversionReport } from '@/lib/quotation-conversion-demo';
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
  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  const session = runtime.demoMode ? null : await getCurrentSession();
  if (!runtime.demoMode && !session) return errorResponse('AUTHENTICATION_REQUIRED', 401, requestId);
  if (session && !can(session.role, 'reports:read')) {
    return errorResponse('REPORT_ACCESS_DENIED', 403, requestId);
  }

  const allowedBusinessUnitIds = session?.allowedBusinessUnitIds ?? [INTERNATIONAL_BUSINESS_UNIT_ID];
  const url = new URL(request.url);
  try {
    const filters = normalizeQuotationConversionFilters({
      request: readFilterInput(url.searchParams),
      allowedBusinessUnitIds,
      now: generatedAt,
    });
    const result = runtime.demoMode
      ? getDemoQuotationConversionReport(filters, generatedAt)
      : await getQuotationConversionReport({
          filters,
          allowedBusinessUnitIds,
          generatedAt,
          detailLimit: 500,
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
    if (message === 'INVALID_REPORT_RANGE' || message === 'INVALID_REPORT_DATE') {
      return errorResponse(message, 400, requestId);
    }
    console.error('[report-api] quotation conversion failed', {
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return errorResponse('REPORT_FAILED', 500, requestId);
  }
}
