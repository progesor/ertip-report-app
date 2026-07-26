import { notFound, redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeCustomerQuotationHistoryFilters,
  type CustomerQuotationHistoryFilterInput,
  type CustomerQuotationHistoryReportWithAmounts,
} from '@ertip/reporting';

import { CustomerQuotationHistoryReportView } from '@/components/customer-quotation-history-report-view';
import { ReportWorkspaceFrame } from '@/components/report-workspace-frame';
import { SourceCurrencyAmountTable } from '@/components/source-currency-amount-tables';
import { getDemoCustomerQuotationHistoryReport } from '@/lib/demo-report';
import { getCustomerQuotationHistoryReport } from '@/lib/reporting';
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
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function createFilterInput(
  customerId: string,
  searchParams: PageSearchParams,
): CustomerQuotationHistoryFilterInput {
  return {
    businessUnitId: firstValue(searchParams.businessUnitId),
    customerId,
    dateFrom: firstValue(searchParams.dateFrom),
    dateTo: firstValue(searchParams.dateTo),
    salespersonId: firstValue(searchParams.salespersonId),
    status: firstValue(searchParams.status),
  };
}

function resolveCustomerUnavailable<T>(loader: () => T): T {
  try {
    return loader();
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_CUSTOMER_UNAVAILABLE') {
      notFound();
    }
    throw error;
  }
}

async function resolveCustomerUnavailableAsync(
  loader: () => Promise<CustomerQuotationHistoryReportWithAmounts>,
): Promise<CustomerQuotationHistoryReportWithAmounts> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_CUSTOMER_UNAVAILABLE') {
      notFound();
    }
    throw error;
  }
}

function reportSurface(
  result: CustomerQuotationHistoryReportWithAmounts,
  user: ReportUser,
  demoMode: boolean,
) {
  return (
    <ReportWorkspaceFrame
      businessUnit={result.businessUnit.displayName}
      category="Müşteriler"
      demoMode={demoMode}
      description="Müşterinin teklif zaman çizelgesini, tekrar sıklığını, satış sonuçlarını ve kaynak para birimi tutarlarını inceleyin."
      generatedAt={result.generatedAt}
      lastSyncAt={result.lastSyncAt}
      title={result.customer.displayName}
      user={user}
    >
      <CustomerQuotationHistoryReportView demoMode={demoMode} result={result} user={user} />
      <div className="workspace-inline-amounts">
        <SourceCurrencyAmountTable
          description="Müşterinin seçili dönemdeki teklifleri kaynak para biriminde ayrı gösterilir."
          eyebrow="Müşteri tutar geçmişi"
          rows={result.amounts}
          title="Teklif ve Gerçekleşen Satış Tutarları"
        />
      </div>
    </ReportWorkspaceFrame>
  );
}

export default async function CustomerQuotationHistoryPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ readonly customerId: string }>;
  searchParams: Promise<PageSearchParams>;
}>) {
  const runtimeConfig = readRuntimeConfig();
  const [{ customerId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  if (!/^\d+$/u.test(customerId)) {
    notFound();
  }
  const generatedAt = new Date();

  if (runtimeConfig.demoMode) {
    const filters = normalizeCustomerQuotationHistoryFilters({
      request: createFilterInput(customerId, resolvedSearchParams),
      allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
      now: generatedAt,
    });
    const result = resolveCustomerUnavailable(() =>
      getDemoCustomerQuotationHistoryReport(filters, generatedAt),
    );

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

  const filters = normalizeCustomerQuotationHistoryFilters({
    request: createFilterInput(customerId, resolvedSearchParams),
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    now: generatedAt,
  });
  const result = await resolveCustomerUnavailableAsync(() =>
    getCustomerQuotationHistoryReport({
      filters,
      allowedBusinessUnitIds: user.allowedBusinessUnitIds,
      generatedAt,
      timelineLimit: 500,
    }),
  );

  return reportSurface(
    result,
    { displayName: user.displayName, email: user.email, role: user.role },
    false,
  );
}
