import Link from 'next/link';

interface ReportUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

interface BusinessUnitOption {
  readonly id: string;
  readonly displayName: string;
}

interface PersonnelDirectoryRow {
  readonly salespersonId: number;
  readonly displayName: string;
  readonly quotationCount: number;
  readonly realizedCount: number;
  readonly customerCount: number;
  readonly firstQuotationDate: string;
  readonly lastQuotationDate: string;
}

const numberFormatter = new Intl.NumberFormat('tr-TR');
const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function PersonnelPerformanceDirectoryView({
  user,
  demoMode,
  rows,
  businessUnits,
  businessUnitId,
  search,
}: Readonly<{
  user: ReportUser;
  demoMode: boolean;
  rows: readonly PersonnelDirectoryRow[];
  businessUnits: readonly BusinessUnitOption[];
  businessUnitId: string;
  search: string;
}>) {
  return (
    <div className="app-shell report-app-shell">
      <aside className="sidebar report-sidebar">
        <Link className="brand" href="/"><b>ER</b><div><strong>Ertip Report</strong><span>Executive Intelligence</span></div></Link>
        <nav aria-label="Rapor navigasyonu">
          <small>Raporlar</small>
          <Link className="nav-item" href="/reports/monthly-quotation-performance"><i>1</i>Aylık Performans</Link>
          <Link className="nav-item" href="/reports/open-aging-quotations"><i>2</i>Yaşlanan Teklifler</Link>
          <Link className="nav-item" href="/reports/customer-quotation-history"><i>3</i>Müşteri Geçmişi</Link>
          <Link className="nav-item active" href="/reports/personnel-performance"><i>4</i>Personel Performansı</Link>
          <small className="nav-heading">Personel seçimi</small>
          <span className="sidebar-report-name">Performans dizini</span>
        </nav>
        <div className="sidebar-footer"><span className="status online" /><div><strong>{demoMode ? 'Demo veri' : 'Canlı PostgreSQL'}</strong><small>Sunucu kapsamı etkin</small></div></div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div><span className="eyebrow">M5.3 · Personel analizi</span><h1>Personel Performansı</h1></div>
          <div className="user-menu"><div><strong>{user.displayName}</strong><span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span></div><Link className="button" href="/">Panele dön</Link></div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges"><span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span><span>Ekip medyanı</span><span>Kaynak para birimleri</span></div>
            <h2>Personel seçin</h2>
            <p>Teklif adedi, gerçekleşen satış, müşteri kapsamı, dönem değişimi ve para birimi bazlı teklif/satış tutarlarını incelemek için personeli açın.</p>
          </div>
        </section>

        <form className="report-filters no-print" method="get">
          <label>
            <span>İş birimi</span>
            <select defaultValue={businessUnitId} name="businessUnitId">
              {businessUnits.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}
            </select>
          </label>
          <label style={{ minWidth: 320 }}>
            <span>Personel ara</span>
            <input defaultValue={search} name="q" placeholder="Personel adı..." type="search" />
          </label>
          <button className="button primary" type="submit">Personelleri Getir</button>
          <Link className="button" href="/reports/personnel-performance">Temizle</Link>
        </form>

        <section className="report-period-summary">
          <div><span className="eyebrow">Sonuç</span><strong>{numberFormatter.format(rows.length)} personel</strong></div>
          <div><span className="eyebrow">Arama</span><strong>{search || 'Son teklif tarihine göre aktif personeller'}</strong></div>
          <div><span className="eyebrow">Analiz</span><strong>Adet + para birimi bazlı tutar</strong></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Personel dizini</span><h3>Performans raporunu aç</h3></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Personel</th><th>Teklif</th><th>Gerçekleşen</th><th>Müşteri</th><th>İlk teklif</th><th>Son teklif</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.salespersonId}>
                    <td><strong>{row.displayName}</strong><small className="table-subtitle">Odoo kullanıcı #{row.salespersonId}</small></td>
                    <td>{numberFormatter.format(row.quotationCount)}</td>
                    <td className="green-text">{numberFormatter.format(row.realizedCount)}</td>
                    <td>{numberFormatter.format(row.customerCount)}</td>
                    <td>{formatDate(row.firstQuotationDate)}</td>
                    <td>{formatDate(row.lastQuotationDate)}</td>
                    <td><Link className="button primary" href={`/reports/personnel-performance/${row.salespersonId}?businessUnitId=${encodeURIComponent(businessUnitId)}`}>Performansı Aç</Link></td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={7}>Arama ölçütüne uyan personel bulunamadı.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
