import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
  type MonthlyQuotationReportFilterInput,
  type MonthlyQuotationReportWithAmounts,
} from '@ertip/reporting';

import { MonthlyQuotationReportView } from '@/components/monthly-quotation-report-view';
import { ReportWorkspaceFrame } from '@/components/report-workspace-frame';
import { SourceCurrencyAmountComparisonTable } from '@/components/source-currency-amount-tables';
import { getDemoMonthlyQuotationReport } from '@/lib/demo-report';
import { getMonthlyQuotationReport } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageSearchParams {
  readonly [key: string]: string | string[] | undefined;
}

interface ReportUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function createFilterInput(searchParams: PageSearchParams): MonthlyQuotationReportFilterInput {
  return {
    businessUnitId: firstValue(searchParams.businessUnitId),
    dateFrom: firstValue(searchParams.dateFrom),
    dateTo: firstValue(searchParams.dateTo),
    salespersonId: firstValue(searchParams.salespersonId),
    customerId: firstValue(searchParams.customerId),
    status: firstValue(searchParams.status),
    view: firstValue(searchParams.view),
  };
}

function reportSurface(
  result: MonthlyQuotationReportWithAmounts,
  user: ReportUser,
  demoMode: boolean,
) {
  return (
    <ReportWorkspaceFrame
      businessUnit={result.businessUnit.displayName}
      category="Satış ve Teklifler"
      demoMode={demoMode}
      description="Teklif üretimini, satış sonuçlarını, dönem karşılaştırmasını ve kaynak para birimi tutarlarını birlikte inceleyin."
      generatedAt={result.generatedAt}
      lastSyncAt={result.lastSyncAt}
      title="Aylık Teklif Performansı"
      user={user}
    >
      <MonthlyQuotationReportView demoMode={demoMode} result={result} user={user} />
      <div className="workspace-inline-amounts">
        <SourceCurrencyAmountComparisonTable
          eyebrow="Aylık kaynak para birimi"
          rows={result.amounts}
          title="Teklif ve Gerçekleşen Satış Tutarları"
        />
      </div>
    </ReportWorkspaceFrame>
  );
}

export default async function MonthlyQuotationPerformancePage({
  searchParams,
}: Readonly<{ searchParams: Promise<PageSearchParams> }>) {
  const runtime = readRuntimeConfig();
  const resolvedSearchParams = await searchParams;
  const generatedAt = new Date();

  if (runtime.demoMode) {
    const filters = normalizeMonthlyQuotationReportFilters({
      request: createFilterInput(resolvedSearchParams),
      allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
      now: generatedAt,
    });
    const result = getDemoMonthlyQuotationReport(filters, generatedAt);
    return reportSurface(
      result,
      { displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' },
      true,
    );
  }

  const user = await getCurrentSession();

  if (!user || !can(user.role, 'reports:read')) {
    redirect('/');
  }

  const filters = normalizeMonthlyQuotationReportFilters({
    request: createFilterInput(resolvedSearchParams),
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    now: generatedAt,
  });
  const result = await getMonthlyQuotationReport({
    filters,
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    generatedAt,
    detailLimit: 500,
  });

  return reportSurface(
    result,
    { displayName: user.displayName, email: user.email, role: user.role },
    false,
  );
}
