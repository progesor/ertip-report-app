import { notFound, redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeCustomerQuotationHistoryFilters,
  type CustomerQuotationHistoryFilterInput,
} from '@ertip/reporting';

import { CustomerQuotationHistoryReportView } from '@/components/customer-quotation-history-report-view';
import { getDemoCustomerQuotationHistoryReport } from '@/lib/demo-report';
import { getCustomerQuotationHistoryReport } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageSearchParams {
  readonly [key: string]: string | string[] | undefined;
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
    try {
      const result = getDemoCustomerQuotationHistoryReport(filters, generatedAt);
      return (
        <CustomerQuotationHistoryReportView
          demoMode
          result={result}
          user={{ displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' }}
        />
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'REPORT_CUSTOMER_UNAVAILABLE') notFound();
      throw error;
    }
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
  try {
    const result = await getCustomerQuotationHistoryReport({
      filters,
      allowedBusinessUnitIds: user.allowedBusinessUnitIds,
      generatedAt,
      timelineLimit: 500,
    });
    return (
      <CustomerQuotationHistoryReportView
        demoMode={false}
        result={result}
        user={{ displayName: user.displayName, email: user.email, role: user.role }}
      />
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_CUSTOMER_UNAVAILABLE') notFound();
    throw error;
  }
}
