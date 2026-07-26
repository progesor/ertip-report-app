import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeQuotationConversionFilters,
  type QuotationConversionFilterInput,
} from '@ertip/reporting';

import { QuotationConversionReportView } from '@/components/quotation-conversion-report-view';
import { getDemoQuotationConversionReport } from '@/lib/quotation-conversion-demo';
import { getQuotationConversionReport } from '@/lib/quotation-conversion-reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageSearchParams {
  readonly [key: string]: string | string[] | undefined;
}

function firstValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function createFilterInput(searchParams: PageSearchParams): QuotationConversionFilterInput {
  return {
    businessUnitId: firstValue(searchParams.businessUnitId),
    dateFrom: firstValue(searchParams.dateFrom),
    dateTo: firstValue(searchParams.dateTo),
    salespersonId: firstValue(searchParams.salespersonId),
    customerId: firstValue(searchParams.customerId),
  };
}

export default async function QuotationConversionPage({
  searchParams,
}: Readonly<{ searchParams: Promise<PageSearchParams> }>) {
  const runtimeConfig = readRuntimeConfig();
  const resolvedSearchParams = await searchParams;
  const generatedAt = new Date();

  if (runtimeConfig.demoMode) {
    const filters = normalizeQuotationConversionFilters({
      request: createFilterInput(resolvedSearchParams),
      allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
      now: generatedAt,
    });
    return (
      <QuotationConversionReportView
        demoMode
        result={getDemoQuotationConversionReport(filters, generatedAt)}
        user={{ displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' }}
      />
    );
  }

  const user = await getCurrentSession();
  if (!user || !can(user.role, 'reports:read')) redirect('/');

  const filters = normalizeQuotationConversionFilters({
    request: createFilterInput(resolvedSearchParams),
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    now: generatedAt,
  });
  const result = await getQuotationConversionReport({
    filters,
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    generatedAt,
    detailLimit: 500,
  });

  return (
    <QuotationConversionReportView
      demoMode={false}
      result={result}
      user={{ displayName: user.displayName, email: user.email, role: user.role }}
    />
  );
}
