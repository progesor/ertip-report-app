import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';

import { ReportLibrary } from '@/components/report-library';
import { WorkspaceShell } from '@/components/workspace-shell';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ReportsPage() {
  const runtime = readRuntimeConfig();

  if (runtime.demoMode) {
    return (
      <WorkspaceShell
        demoMode
        pageDescription="Satış, müşteri, ekip ve operasyon raporlarını tek merkezden açın."
        pageTitle="Raporlar"
        user={{ displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' }}
      >
        <ReportLibrary />
      </WorkspaceShell>
    );
  }

  const user = await getCurrentSession();
  if (!user || !can(user.role, 'reports:read')) {
    redirect('/');
  }

  return (
    <WorkspaceShell
      demoMode={false}
      pageDescription="Satış, müşteri, ekip ve operasyon raporlarını tek merkezden açın."
      pageTitle="Raporlar"
      user={{ displayName: user.displayName, email: user.email, role: user.role }}
    >
      <ReportLibrary />
    </WorkspaceShell>
  );
}
