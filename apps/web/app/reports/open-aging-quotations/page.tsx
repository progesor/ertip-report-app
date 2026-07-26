import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeOpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportFilterInput,
  type OpenAgingQuotationReportWithAmounts,
} from '@ertip/reporting';

import { OpenAgingQuotationReportView } from '@/components/open-aging-quotation-report-view';
import { ReportWorkspaceFrame } from '@/components/report-workspace-frame';
import { SourceCurrencyAmountTable } from '@/components/source-currency-amount-tables';
import { getDemoOpenAgingQuotationReport } from '@/lib/demo-report';
import { getOpenAgingQuotationReport } from '@/lib/reporting';
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

function createFilterInput(searchParams: PageSearchParams): OpenAgingQuotationReportFilterInput {
  return {
    businessUnitId: firstValue(searchParams.businessUnitId),
    salespersonId: firstValue(searchParams.salespersonId),
    customerId: firstValue(searchParams.customerId),
    ageBucket: firstValue(searchParams.ageBucket),
    validityGroup: firstValue(searchParams.validityGroup),
  };
}

function reportSurface(
  result: OpenAgingQuotationReportWithAmounts,
  user: ReportUser,
  demoMode: boolean,
) {
  return (
    <ReportWorkspaceFrame
      businessUnit={result.businessUnit.displayName}
      category="Operasyonel Takip"
      demoMode={demoMode}
      description="Takip bekleyen teklifleri yaş, geçerlilik, sorumlu ve kaynak para birimi tutarlarıyla önceliklendirin."
      generatedAt={result.generatedAt}
      lastSyncAt={result.lastSyncAt}
      title="Açık ve Yaşlanan Teklifler"
      user={user}
    >
      <OpenAgingQuotationReportView demoMode={demoMode} result={result} user={user} />
      <div className="workspace-inline-amounts">
        <SourceCurrencyAmountTable
          description="Takipteki teklif tutarları kaynak para biriminde gösterilir; süresi dolmuş teklifler açık tutara dahil edilmez."
          eyebrow="Operasyonel tutar analizi"
          rows={result.amounts}
          title="Açık ve Yaşlanan Teklif Tutarları"
        />
      </div>
    </ReportWorkspaceFrame>
  );
}

export default async function OpenAgingQuotationsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<PageSearchParams> }>) {
  const runtime = readRuntimeConfig();
  const resolvedSearchParams = await searchParams;
  const generatedAt = new Date();

  if (runtime.demoMode) {
    const filters = normalizeOpenAgingQuotationReportFilters({
      request: createFilterInput(resolvedSearchParams),
      allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    });
    const result = getDemoOpenAgingQuotationReport(filters, generatedAt);
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

  const filters = normalizeOpenAgingQuotationReportFilters({
    request: createFilterInput(resolvedSearchParams),
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
  });
  const result = await getOpenAgingQuotationReport({
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
