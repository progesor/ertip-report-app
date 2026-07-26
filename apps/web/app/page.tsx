import Link from 'next/link';

import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';

import { AuthPage } from '@/components/auth-page';
import { DashboardShell } from '@/components/dashboard-shell';
import { OwnerSetup } from '@/components/owner-setup';
import { SetupRequired } from '@/components/setup-required';
import { getAppDatabase, getDatabaseHealth } from '@/lib/database';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ReportDashboardEntry() {
  return (
    <aside
      aria-label="Hızlı rapor menüsü"
      className="panel no-print"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 40,
        width: 340,
        boxShadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div className="panel-title">
        <div><span className="eyebrow">Hızlı erişim</span><h3>Raporlar</h3></div>
        <Link href="/reports/monthly-quotation-performance">Tümü</Link>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <Link className="button" href="/reports/monthly-quotation-performance">Aylık Teklif Performansı</Link>
        <Link className="button" href="/reports/open-aging-quotations">Açık ve Yaşlanan Teklifler</Link>
        <Link className="button" href="/reports/customer-quotation-history">Müşteri Teklif Geçmişi</Link>
        <Link className="button" href="/reports/personnel-performance">Personel Performansı</Link>
        <Link className="button primary" href="/reports/quotation-conversion">Tekliften Siparişe Dönüşüm</Link>
      </div>
    </aside>
  );
}

export default async function HomePage() {
  const runtimeConfig = readRuntimeConfig();
  const runtimeStatus = getSafeRuntimeStatus(runtimeConfig);
  const nowIso = new Date().toISOString();

  if (runtimeStatus.demoMode) {
    return (
      <>
        <DashboardShell
          demoMode
          latestOdooCheck={null}
          nowIso={nowIso}
          odooConfigured={runtimeStatus.odoo.configured}
          user={{ displayName: 'Anıl Akman', email: 'demo@ertipmedical.com', role: 'owner' }}
        />
        <ReportDashboardEntry />
      </>
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
    <>
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
      <ReportDashboardEntry />
    </>
  );
}
