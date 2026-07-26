import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';

import { AuthPage } from '@/components/auth-page';
import { DashboardShell } from '@/components/dashboard-shell';
import { OwnerSetup } from '@/components/owner-setup';
import { SetupRequired } from '@/components/setup-required';
import { getAppDatabase, getDatabaseHealth } from '@/lib/database';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HomePage() {
  const runtimeConfig = readRuntimeConfig();
  const runtimeStatus = getSafeRuntimeStatus(runtimeConfig);
  const nowIso = new Date().toISOString();

  if (runtimeStatus.demoMode) {
    return (
      <DashboardShell
        demoMode
        latestOdooCheck={null}
        nowIso={nowIso}
        odooConfigured={runtimeStatus.odoo.configured}
        user={{ displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' }}
      />
    );
  }

  const databaseHealth = await getDatabaseHealth();

  if (
    !databaseHealth.configured ||
    !databaseHealth.reachable ||
    !runtimeStatus.authentication.configured
  ) {
    return (
      <SetupRequired
        appName={runtimeStatus.appName}
        authenticationConfigured={runtimeStatus.authentication.configured}
        databaseConfigured={databaseHealth.configured}
        databaseReachable={databaseHealth.reachable}
        odooDatabaseConfigured={runtimeStatus.odoo.databaseConfigured}
        odooHost={runtimeStatus.odoo.host}
      />
    );
  }

  if ((databaseHealth.userCount ?? 0) === 0) {
    return (
      <OwnerSetup
        appName={runtimeStatus.appName}
        bootstrapConfigured={runtimeStatus.authentication.bootstrapConfigured}
        odooHost={runtimeStatus.odoo.host}
      />
    );
  }

  const currentUser = await getCurrentSession();

  if (!currentUser) {
    return (
      <AuthPage
        appName={runtimeStatus.appName}
        odooConfigured={runtimeStatus.odoo.configured}
      />
    );
  }

  const database = await getAppDatabase();
  const latestOdooCheck =
    currentUser.role === 'owner' ? await database.getLatestOdooConnectionCheck() : null;

  return (
    <DashboardShell
      demoMode={false}
      latestOdooCheck={
        latestOdooCheck
          ? { ...latestOdooCheck, checkedAt: latestOdooCheck.checkedAt.toISOString() }
          : null
      }
      nowIso={nowIso}
      odooConfigured={runtimeStatus.odoo.configured}
      user={{
        displayName: currentUser.displayName,
        email: currentUser.email,
        role: currentUser.role,
      }}
    />
  );
}
