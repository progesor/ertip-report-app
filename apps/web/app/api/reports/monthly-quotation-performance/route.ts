import { NextResponse } from 'next/server';

import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
  type MonthlyQuotationReportFilterInput,
} from '@ertip/reporting';

import { getDemoMonthlyQuotationReport } from '@/lib/demo-report';
import { getMonthlyQuotationReport } from '@/lib/reporting';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createFilterInput(url: URL): MonthlyQuotationReportFilterInput {
  return {
    businessUnitId: url.searchParams.get('businessUnitId'),
    dateFrom: url.searchParams.get('dateFrom'),
    dateTo: url.searchParams.get('dateTo'),
    salespersonId: url.searchParams.get('salespersonId'),
    customerId: url.searchParams.get('customerId'),
    status: url.searchParams.get('status'),
    view: url.searchParams.get('view'),
  };
}

export async function GET(request: Request) {
  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  const url = new URL(request.url);

  try {
    if (runtime.demoMode) {
      const filters = normalizeMonthlyQuotationReportFilters({
        request: createFilterInput(url),
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: generatedAt,
      });
      return NextResponse.json(
        { ok: true, result: getDemoMonthlyQuotationReport(filters, generatedAt) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const user = await requirePermission('reports:read');
    const filters = normalizeMonthlyQuotationReportFilters({
      request: createFilterInput(url),
      allowedBusinessUnitIds: user.allowedBusinessUnitIds,
      now: generatedAt,
    });
    const result = await getMonthlyQuotationReport({
      filters,
      allowedBusinessUnitIds: user.allowedBusinessUnitIds,
      generatedAt,
      detailLimit: 500,
    });

    return NextResponse.json(
      { ok: true, result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    if (
      error instanceof Error &&
      ['INVALID_REPORT_DATE', 'INVALID_REPORT_RANGE', 'REPORT_SCOPE_EMPTY'].includes(error.message)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Rapor filtreleri geçerli değil.' },
        { status: 400 },
      );
    }

    console.error('[report] monthly quotation report failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Rapor oluşturulamadı.' },
      { status: 500 },
    );
  }
}
