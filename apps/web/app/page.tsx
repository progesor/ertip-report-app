import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';

import { DashboardShell } from '@/components/dashboard-shell';
import { SetupRequired } from '@/components/setup-required';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const runtime = getSafeRuntimeStatus(readRuntimeConfig());

  if (!runtime.demoMode) {
    return (
      <SetupRequired
        databaseConfigured={runtime.odoo.databaseConfigured}
        odooHost={runtime.odoo.host}
      />
    );
  }

  return <DashboardShell demoMode={runtime.demoMode} odooConfigured={runtime.odoo.configured} />;
}
