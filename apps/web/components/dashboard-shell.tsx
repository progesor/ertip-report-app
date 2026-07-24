'use client';

import { useState } from 'react';

import { can, type AppRole } from '@ertip/auth';

import { monthlyTrend, salespersonRows } from '@/lib/demo-data';

const workspaceItems = ['Genel Bakış', 'Raporlar', 'Kaydedilmiş Çıktılar'] as const;
const ownerItems = [
  'Rapor Şablonları',
  'Kullanıcılar',
  'İş Birimleri',
  'Odoo Bağlantısı',
  'Senkronizasyon',
  'Veri Kalitesi',
  'Denetim Kayıtları',
] as const;

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

export function DashboardShell({
  demoMode,
  odooConfigured,
}: Readonly<{ demoMode: boolean; odooConfigured: boolean }>) {
  const [role, setRole] = useState<AppRole>('owner');
  const canManage = can(role, 'admin:connections');
  const maxTrend = Math.max(...monthlyTrend.map(({ value }) => value));

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
            <button className={index === 0 ? 'nav-item active' : 'nav-item'} key={item} type="button">
              <i aria-hidden="true">{index + 1}</i>{item}
            </button>
          ))}
          {canManage ? (
            <>
              <small className="nav-heading">Yönetim</small>
              {ownerItems.map((item, index) => (
                <button className="nav-item" key={item} type="button">
                  <i aria-hidden="true">{String.fromCharCode(65 + index)}</i>{item}
                </button>
              ))}
            </>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <span className={odooConfigured ? 'status online' : 'status warning'} />
          <div><strong>{odooConfigured ? 'Odoo hazır' : 'Odoo yapılandırılıyor'}</strong><small>Salt okunur bağlantı</small></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="eyebrow">24 Temmuz 2026 · Cuma</span><h1>Günaydın, Anıl</h1></div>
          {demoMode ? (
            <div className="role-switch" aria-label="Demo rol önizlemesi">
              {(['owner', 'manager'] as const).map((item) => (
                <button
                  aria-pressed={role === item}
                  className={role === item ? 'selected' : ''}
                  key={item}
                  onClick={() => setRole(item)}
                  type="button"
                >
                  {item === 'owner' ? 'Owner' : 'Manager'}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <section className="hero">
          <div>
            <div className="badges"><span>Yurt Dışı</span><span>Temmuz 2026</span>{demoMode ? <span>Demo veri</span> : null}</div>
            <h2>Aylık Teklif Performansı</h2>
            <p>Teklif üretimini, dönüşümü ve müşteri dağılımını tek güvenilir görünümde izleyin.</p>
          </div>
          <div className="actions"><button type="button">Yazdır</button><button type="button">Excel</button><button className="primary" type="button">Raporu Aç</button></div>
        </section>

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

        <footer><span className={odooConfigured ? 'status online' : 'status warning'} />{odooConfigured ? 'Odoo bağlantı bilgileri hazır.' : 'API anahtarı Coolify runtime secret olarak bekleniyor.'}<a href="/api/system/status">Sistem durumu</a></footer>
      </main>
    </div>
  );
}
