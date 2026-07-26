'use client';

import Link from 'next/link';
import { useState } from 'react';

import { can, type AppRole } from '@ertip/auth';

import { SyncControlPanel } from '@/components/sync-control-panel';
import { TenantDiscoveryPanel } from '@/components/tenant-discovery-panel';
import { monthlyTrend, salespersonRows } from '@/lib/demo-data';

const workspaceItems = [
  { label: 'Genel Bakış', href: '/' },
  { label: 'Raporlar', href: '/reports' },
  { label: 'Aylık Teklif Performansı', href: '/reports/monthly-quotation-performance' },
  { label: 'Personel Performansı', href: '/reports/personnel-performance' },
] as const;
const ownerItems = [
  { label: 'Rapor Şablonları', href: null },
  { label: 'Kullanıcılar', href: null },
  { label: 'İş Birimleri', href: null },
  { label: 'Odoo Bağlantısı', href: null },
  { label: 'Senkronizasyon', href: null },
  { label: 'Veri Kalitesi', href: null },
  { label: 'Denetim Kayıtları', href: '/owner/audit-logs' },
] as const;

interface DashboardUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: AppRole;
}

interface LatestOdooCheck {
  readonly status: 'success' | 'failure';
  readonly serverVersion: string | null;
  readonly companyCount: number | null;
  readonly durationMs: number;
  readonly safeErrorCode: string | null;
  readonly checkedAt: string;
}

interface OdooTestResponse {
  readonly ok?: boolean;
  readonly error?: string;
  readonly code?: string;
  readonly result?: {
    readonly serverVersion: string;
    readonly companyCount: number;
    readonly durationMs: number;
    readonly checkedAt: string;
  };
}

function MetricCard({
  label,
  value,
  change,
  tone,
}: Readonly<{ label: string; value: string; change: string; tone: string }>) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{change} · geçen aya göre</small>
    </article>
  );
}

function formatDashboardDate(isoValue: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(new Date(isoValue));
}

function getGreeting(isoValue: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(isoValue)),
  );

  if (hour < 12) {
    return 'Günaydın';
  }

  if (hour < 18) {
    return 'İyi günler';
  }

  return 'İyi akşamlar';
}

export function DashboardShell({
  demoMode,
  odooConfigured,
  user,
  latestOdooCheck,
  nowIso,
}: Readonly<{
  demoMode: boolean;
  odooConfigured: boolean;
  user: DashboardUser;
  latestOdooCheck: LatestOdooCheck | null;
  nowIso: string;
}>) {
  const [previewRole, setPreviewRole] = useState<AppRole>(user.role);
  const [connectionCheck, setConnectionCheck] = useState<{
    readonly state: 'idle' | 'testing' | 'success' | 'failure';
    readonly message: string;
  }>({
    state: latestOdooCheck?.status ?? 'idle',
    message:
      latestOdooCheck?.status === 'success'
        ? `${latestOdooCheck.serverVersion ?? 'Odoo'} · ${latestOdooCheck.companyCount ?? 0} şirket · ${latestOdooCheck.durationMs} ms`
        : latestOdooCheck?.status === 'failure'
          ? `Son test başarısız: ${latestOdooCheck.safeErrorCode ?? 'Bilinmeyen hata'}`
          : 'Henüz canlı bağlantı testi yapılmadı.',
  });
  const role = demoMode ? previewRole : user.role;
  const canManage = can(role, 'admin:connections');
  const maxTrend = Math.max(...monthlyTrend.map(({ value }) => value));

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  async function handleOdooTest() {
    setConnectionCheck({ state: 'testing', message: 'Odoo bağlantısı doğrulanıyor…' });

    try {
      const response = await fetch('/api/owner/odoo/test', { method: 'POST' });
      const payload = (await response.json()) as OdooTestResponse;

      if (!response.ok || !payload.ok || !payload.result) {
        setConnectionCheck({
          state: 'failure',
          message: payload.code
            ? `${payload.error ?? 'Bağlantı testi başarısız.'} (${payload.code})`
            : payload.error ?? 'Bağlantı testi başarısız.',
        });
        return;
      }

      setConnectionCheck({
        state: 'success',
        message: `${payload.result.serverVersion} · ${payload.result.companyCount} şirket · ${payload.result.durationMs} ms`,
      });
    } catch {
      setConnectionCheck({ state: 'failure', message: 'Bağlantı testi sırasında sunucuya ulaşılamadı.' });
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <b>ER</b>
          <div><strong>Ertip Report</strong><span>Executive Intelligence</span></div>
        </div>

        <nav aria-label="Ana navigasyon">
          <small>Çalışma Alanı</small>
          {workspaceItems.map((item, index) => (
            <Link
              className={item.href === '/' ? 'nav-item active' : 'nav-item'}
              href={item.href}
              key={item.href}
            >
              <i aria-hidden="true">{index + 1}</i>{item.label}
            </Link>
          ))}
          {canManage ? (
            <>
              <small className="nav-heading">Yönetim</small>
              {ownerItems.map((item, index) =>
                item.href ? (
                  <Link className="nav-item" href={item.href} key={item.label}>
                    <i aria-hidden="true">{String.fromCharCode(65 + index)}</i>{item.label}
                  </Link>
                ) : (
                  <button className="nav-item" key={item.label} type="button">
                    <i aria-hidden="true">{String.fromCharCode(65 + index)}</i>{item.label}
                  </button>
                ),
              )}
            </>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <span className={odooConfigured ? 'status online' : 'status warning'} />
          <div><strong>{odooConfigured ? 'Odoo secret hazır' : 'Odoo yapılandırılıyor'}</strong><small>Salt okunur bağlantı</small></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{formatDashboardDate(nowIso)}</span>
            <h1>{getGreeting(nowIso)}, {user.displayName.split(' ')[0]}</h1>
          </div>
          {demoMode ? (
            <div className="role-switch" aria-label="Demo rol önizlemesi">
              {(['owner', 'manager'] as const).map((item) => (
                <button
                  aria-pressed={previewRole === item}
                  className={previewRole === item ? 'selected' : ''}
                  key={item}
                  onClick={() => setPreviewRole(item)}
                  type="button"
                >
                  {item === 'owner' ? 'Owner' : 'Manager'}
                </button>
              ))}
            </div>
          ) : (
            <div className="user-menu">
              <div>
                <strong>{user.displayName}</strong>
                <span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span>
              </div>
              <button onClick={handleLogout} type="button">Çıkış</button>
            </div>
          )}
        </header>

        <section className="hero">
          <div>
            <div className="badges"><span>Yurt Dışı</span><span>create_date kohortu</span>{demoMode ? <span>Demo veri</span> : <span>Canlı rapor hazır</span>}</div>
            <h2>Aylık Teklif Performansı</h2>
            <p>Teklif üretimini, güncel sonuç durumunu, personel performansını ve müşteri dağılımını yerel PostgreSQL verisinden izleyin.</p>
          </div>
          <div className="actions">
            {demoMode ? <><button type="button">Yazdır</button><button type="button">Excel</button></> : null}
            <Link className="button" href="/reports">Tüm Raporlar</Link>
            <Link className="button primary" href="/reports/monthly-quotation-performance">Raporu Aç</Link>
          </div>
        </section>

        {canManage && !demoMode ? (
          <section className={`connection-banner ${connectionCheck.state}`} aria-live="polite">
            <div>
              <span className="eyebrow">Owner bağlantı kontrolü</span>
              <h3>Odoo Online JSON-2</h3>
              <p>{connectionCheck.message}</p>
            </div>
            <button
              disabled={!odooConfigured || connectionCheck.state === 'testing'}
              onClick={handleOdooTest}
              type="button"
            >
              {connectionCheck.state === 'testing' ? 'Test Ediliyor…' : 'Odoo Bağlantısını Test Et'}
            </button>
          </section>
        ) : null}

        {canManage && !demoMode ? <TenantDiscoveryPanel odooConfigured={odooConfigured} /> : null}
        {canManage && !demoMode ? <SyncControlPanel odooConfigured={odooConfigured} /> : null}

        {demoMode ? (
          <>
            <section className="metric-grid" aria-label="Ana performans göstergeleri">
              <MetricCard change="+12,4%" label="Toplam Teklif" tone="cyan" value="34" />
              <MetricCard change="+8,1%" label="Gerçekleşen" tone="green" value="12" />
              <MetricCard change="+2" label="Açık Teklif" tone="amber" value="14" />
              <MetricCard change="-5,3%" label="Gerçekleşmeyen" tone="red" value="8" />
            </section>

            <section className="analytics-grid">
              <article className="panel">
                <div className="panel-title"><div><span className="eyebrow">6 aylık görünüm</span><h3>Aylık Teklif Eğilimi</h3></div><button type="button">Son 6 Ay</button></div>
                <div className="bars" role="img" aria-label="Son altı aylık teklif eğilimi">
                  {monthlyTrend.map(({ month, value }) => (
                    <div className="bar" key={month}><b>{value}</b><i style={{ height: `${(value / maxTrend) * 100}%` }} /><span>{month}</span></div>
                  ))}
                </div>
              </article>

              <article className="panel distribution">
                <div className="panel-title"><div><span className="eyebrow">Durum özeti</span><h3>Teklif Dağılımı</h3></div></div>
                <div className="donut"><div><strong>%35,3</strong><span>Dönüşüm</span></div></div>
                <ul><li><i className="green" />Gerçekleşen <b>12</b></li><li><i className="amber" />Açık <b>14</b></li><li><i className="red" />Gerçekleşmeyen <b>8</b></li></ul>
              </article>
            </section>

            <section className="panel table-panel">
              <div className="panel-title"><div><span className="eyebrow">Ekip görünümü</span><h3>Personel Karşılaştırması</h3></div><input aria-label="Personel ara" placeholder="Personel ara..." type="search" /></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Personel</th><th>Teklif</th><th>Gerçekleşen</th><th>Açık</th><th>Gerçekleşmeyen</th><th>Dönüşüm</th><th>Değişim</th></tr></thead>
                  <tbody>{salespersonRows.map((row) => (
                    <tr key={row.name}>
                      <td><div className="person"><span>{row.initials}</span><div><strong>{row.name}</strong><small>Yurt Dışı Satış</small></div></div></td>
                      <td>{row.quotations}</td><td className="green-text">{row.realized}</td><td className="amber-text">{row.open}</td><td className="red-text">{row.notRealized}</td>
                      <td><div className="progress"><i style={{ width: `${row.conversion}%` }} /></div>%{row.conversion.toFixed(1).replace('.', ',')}</td>
                      <td className={row.movement < 0 ? 'red-text' : 'green-text'}>{row.movement > 0 ? '↗' : '↘'} %{Math.abs(row.movement).toFixed(1).replace('.', ',')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="panel">
            <div className="panel-title">
              <div><span className="eyebrow">Canlı raporlama</span><h3>Yönetim raporları hazır</h3></div>
              <Link className="button primary" href="/reports">Rapor Kütüphanesini Aç</Link>
            </div>
            <p>Satış, müşteri, ekip ve operasyon raporlarını tek katalogdan açın. Tüm görünümler aynı merkezi metrik ve yetki sözleşmelerini kullanır.</p>
          </section>
        )}

        <footer><span className={odooConfigured ? 'status online' : 'status warning'} />{odooConfigured ? 'Odoo runtime secret hazır.' : 'API anahtarı Coolify runtime secret olarak bekleniyor.'}<a href="/api/system/status">Sistem durumu</a></footer>
      </main>
    </div>
  );
}
