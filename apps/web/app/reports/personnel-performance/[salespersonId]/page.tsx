import { notFound, redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizePersonnelPerformanceFilters,
  type PersonnelPerformanceFilterInput,
  type PersonnelPerformanceReportResult,
} from '@ertip/reporting';

import { PersonnelPerformanceReportView } from '@/components/personnel-performance-report-view';
import { ReportWorkspaceFrame } from '@/components/report-workspace-frame';
import { getDemoPersonnelPerformanceReport } from '@/lib/demo-report';
import { getPersonnelPerformanceReport } from '@/lib/reporting';
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
  salespersonId: string,
  searchParams: PageSearchParams,
): PersonnelPerformanceFilterInput {
  return {
    businessUnitId: firstValue(searchParams.businessUnitId),
    salespersonId,
    dateFrom: firstValue(searchParams.dateFrom),
    dateTo: firstValue(searchParams.dateTo),
    customerId: firstValue(searchParams.customerId),
    status: firstValue(searchParams.status),
  };
}

function resolveSalespersonUnavailable<T>(loader: () => T): T {
  try {
    return loader();
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_SALESPERSON_UNAVAILABLE') {
      notFound();
    }
    throw error;
  }
}

async function resolveSalespersonUnavailableAsync(
  loader: () => Promise<PersonnelPerformanceReportResult>,
): Promise<PersonnelPerformanceReportResult> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_SALESPERSON_UNAVAILABLE') {
      notFound();
    }
    throw error;
  }
}

function reportSurface(
  result: PersonnelPerformanceReportResult,
  user: ReportUser,
  demoMode: boolean,
) {
  return (
    <ReportWorkspaceFrame
      businessUnit={result.businessUnit.displayName}
      category="Ekip Performansı"
      demoMode={demoMode}
      description="Personelin teklif üretimini, satış dönüşümünü, ekip medyanını, müşteri yoğunluğunu ve tutar performansını inceleyin."
      generatedAt={result.generatedAt}
      lastSyncAt={result.lastSyncAt}
      title={result.salesperson.displayName}
      user={user}
    >
      <PersonnelPerformanceReportView demoMode={demoMode} result={result} user={user} />
    </ReportWorkspaceFrame>
  );
}

export default async function PersonnelPerformancePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ readonly salespersonId: string }>;
  searchParams: Promise<PageSearchParams>;
}>) {
  const runtimeConfig = readRuntimeConfig();
  const [{ salespersonId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  if (!/^\d+$/u.test(salespersonId)) {
    notFound();
  }
  const generatedAt = new Date();

  if (runtimeConfig.demoMode) {
    const filters = normalizePersonnelPerformanceFilters({
      request: createFilterInput(salespersonId, resolvedSearchParams),
      allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
      now: generatedAt,
    });
    const result = resolveSalespersonUnavailable(() =>
      getDemoPersonnelPerformanceReport(filters, generatedAt),
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

  const filters = normalizePersonnelPerformanceFilters({
    request: createFilterInput(salespersonId, resolvedSearchParams),
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    now: generatedAt,
  });
  const result = await resolveSalespersonUnavailableAsync(() =>
    getPersonnelPerformanceReport({
      filters,
      allowedBusinessUnitIds: user.allowedBusinessUnitIds,
      generatedAt,
      detailLimit: 500,
    }),
  );

  return reportSurface(
    result,
    { displayName: user.displayName, email: user.email, role: user.role },
    false,
  );
}
