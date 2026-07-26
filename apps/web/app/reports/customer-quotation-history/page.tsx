import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';
import { INTERNATIONAL_BUSINESS_UNIT_ID } from '@ertip/reporting';

import { CustomerHistoryDirectoryView } from '@/components/customer-history-directory-view';
import { WorkspaceShell } from '@/components/workspace-shell';
import { getDemoCustomerQuotationHistoryDirectory } from '@/lib/demo-report';
import { getCustomerQuotationHistoryDirectory } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const domesticBusinessUnitId = '22222222-2222-4222-8222-222222222222';

interface PageSearchParams {
  readonly [key: string]: string | string[] | undefined;
}

interface DirectoryUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function businessUnitName(id: string): string {
  if (id === INTERNATIONAL_BUSINESS_UNIT_ID) return 'Yurt Dışı';
  if (id === domesticBusinessUnitId) return 'Yurt İçi';
  return 'İş Birimi';
}

function directorySurface(input: {
  readonly user: DirectoryUser;
  readonly demoMode: boolean;
  readonly businessUnitId: string;
  readonly businessUnits: readonly { readonly id: string; readonly displayName: string }[];
  readonly rows: Parameters<typeof CustomerHistoryDirectoryView>[0]['rows'];
  readonly search: string;
}) {
  return (
    <WorkspaceShell
      demoMode={input.demoMode}
      pageDescription="Müşteri seçerek teklif zaman çizelgesini, tekrar sıklığını ve kaynak para birimi tutar geçmişini açın."
      pageTitle="Müşteri Teklif Geçmişi"
      user={input.user}
    >
      <div className="workspace-report-host">
        <CustomerHistoryDirectoryView
          businessUnitId={input.businessUnitId}
          businessUnits={input.businessUnits}
          demoMode={input.demoMode}
          rows={input.rows}
          search={input.search}
          user={input.user}
        />
      </div>
    </WorkspaceShell>
  );
}

export default async function CustomerQuotationHistoryDirectoryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<PageSearchParams> }>) {
  const runtimeConfig = readRuntimeConfig();
  const resolved = await searchParams;
  const search = firstValue(resolved.q).trim();

  if (runtimeConfig.demoMode) {
    return directorySurface({
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      businessUnits: [{ id: INTERNATIONAL_BUSINESS_UNIT_ID, displayName: 'Yurt Dışı' }],
      demoMode: true,
      rows: getDemoCustomerQuotationHistoryDirectory(search),
      search,
      user: { displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' },
    });
  }

  const user = await getCurrentSession();
  if (!user || !can(user.role, 'reports:read')) {
    redirect('/');
  }

  const requestedBusinessUnitId = firstValue(resolved.businessUnitId).trim();
  const businessUnitId =
    requestedBusinessUnitId && user.allowedBusinessUnitIds.includes(requestedBusinessUnitId)
      ? requestedBusinessUnitId
      : user.allowedBusinessUnitIds[0];
  if (!businessUnitId) {
    redirect('/');
  }

  const rows = await getCustomerQuotationHistoryDirectory({
    businessUnitId,
    allowedBusinessUnitIds: user.allowedBusinessUnitIds,
    search,
    limit: 50,
  });

  return directorySurface({
    businessUnitId,
    businessUnits: user.allowedBusinessUnitIds.map((id) => ({ id, displayName: businessUnitName(id) })),
    demoMode: false,
    rows,
    search,
    user: { displayName: user.displayName, email: user.email, role: user.role },
  });
}
