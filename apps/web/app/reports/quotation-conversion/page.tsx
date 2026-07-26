import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeQuotationConversionFilters,
  type QuotationConversionFilterInput,
  type QuotationConversionReportResult,
} from '@ertip/reporting';

import { QuotationConversionReportView } from '@/components/quotation-conversion-report-view';
import { ReportWorkspaceFrame } from '@/components/report-workspace-frame';
import { getDemoQuotationConversionReport } from '@/lib/quotation-conversion-demo';
import { getQuotationConversionReport } from '@/lib/quotation-conversion-reporting';
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

function createFilterInput(searchParams: PageSearchParams): QuotationConversionFilterInput {
  return {
    businessUnitId: firstValue(searchParams.businessUnitId),
    dateFrom: firstValue(searchParams.dateFrom),
    dateTo: firstValue(searchParams.dateTo),
    salespersonId: firstValue(searchParams.salespersonId),
    customerId: firstValue(searchParams.customerId),
  };
}

function reportSurface(
  result: QuotationConversionReportResult,
  user: ReportUser,
  demoMode: boolean,
) {
  return (
    <ReportWorkspaceFrame
      businessUnit={result.businessUnit.displayName}
      category="Satış ve Teklifler"
      demoMode={demoMode}
      description="Teklif kohortlarının siparişe dönüşme oranını, gerçekleşme süresini, çapraz ay hareketlerini ve kaynak anomalilerini inceleyin."
      generatedAt={result.generatedAt}
      lastSyncAt={result.lastSyncAt}
      showEmbeddedHeading
      title="Tekliften Siparişe Dönüşüm"
      user={user}
    >
      <QuotationConversionReportView demoMode={demoMode} result={result} user={user} />
    </ReportWorkspaceFrame>
  );
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
    const result = getDemoQuotationConversionReport(filters, generatedAt);
    return reportSurface(
      result,
      { displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' },
      true,
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

  return reportSurface(
    result,
    { displayName: user.displayName, email: user.email, role: user.role },
    false,
  );
}
