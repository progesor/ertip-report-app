import { NextResponse } from 'next/server';

import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeOpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportFilterInput,
} from '@ertip/reporting';

import { getDemoOpenAgingQuotationReport } from '@/lib/demo-report';
import { getOpenAgingQuotationReport } from '@/lib/reporting';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createFilterInput(url: URL): OpenAgingQuotationReportFilterInput {
  return {
    businessUnitId: url.searchParams.get('businessUnitId'),
    salespersonId: url.searchParams.get('salespersonId'),
    customerId: url.searchParams.get('customerId'),
    ageBucket: url.searchParams.get('ageBucket'),
    validityGroup: url.searchParams.get('validityGroup'),
  };
}

export async function GET(request: Request) {
  const runtime = readRuntimeConfig();
  const generatedAt = new Date();
  const url = new URL(request.url);

  try {
    if (runtime.demoMode) {
      const filters = normalizeOpenAgingQuotationReportFilters({
        request: createFilterInput(url),
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
      });
      return NextResponse.json(
        { ok: true, result: getDemoOpenAgingQuotationReport(filters, generatedAt) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const user = await requirePermission('reports:read');
    const filters = normalizeOpenAgingQuotationReportFilters({
      request: createFilterInput(url),
      allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    });
    const result = await getOpenAgingQuotationReport({
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
      (error.message === 'REPORT_SCOPE_DENIED' || error.message === 'REPORT_SCOPE_EMPTY')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Bu iş birimi kapsamına erişiminiz yok.' },
        { status: 403 },
      );
    }

    console.error('[report] open aging quotation report failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Rapor oluşturulamadı.' },
      { status: 500 },
    );
  }
}
