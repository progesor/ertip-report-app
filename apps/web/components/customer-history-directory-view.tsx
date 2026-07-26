interface ReportUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

interface BusinessUnitOption {
  readonly id: string;
  readonly displayName: string;
}

interface CustomerDirectoryRow {
  readonly customerId: number;
  readonly displayName: string;
  readonly quotationCount: number;
  readonly salespersonCount: number;
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

export function CustomerHistoryDirectoryView({
  user,
  demoMode,
  rows,
  businessUnits,
  businessUnitId,
  search,
}: Readonly<{
  user: ReportUser;
  demoMode: boolean;
  rows: readonly CustomerDirectoryRow[];
  businessUnits: readonly BusinessUnitOption[];
  businessUnitId: string;
  search: string;
}>) {
  return (
    <div className="app-shell report-app-shell">
      <aside className="sidebar report-sidebar">
        <a className="brand" href="/"><b>ER</b><div><strong>Ertip Report</strong><span>Executive Intelligence</span></div></a>
        <nav aria-label="Rapor navigasyonu">
          <small>Raporlar</small>
          <a className="nav-item" href="/reports/monthly-quotation-performance"><i>1</i>Aylık Performans</a>
          <a className="nav-item" href="/reports/open-aging-quotations"><i>2</i>Yaşlanan Teklifler</a>
          <a className="nav-item active" href="/reports/customer-quotation-history"><i>3</i>Müşteri Geçmişi</a>
          <small className="nav-heading">Müşteri seçimi</small>
          <span className="sidebar-report-name">Teklif geçmişi dizini</span>
        </nav>
        <div className="sidebar-footer"><span className="status online" /><div><strong>{demoMode ? 'Demo veri' : 'Canlı PostgreSQL'}</strong><small>Sunucu kapsamı etkin</small></div></div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div><span className="eyebrow">M5.2 · Müşteri analizi</span><h1>Müşteri Teklif Geçmişi</h1></div>
          <div className="user-menu"><div><strong>{user.displayName}</strong><span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span></div><a className="button" href="/">Panele dön</a></div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges"><span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span><span>Doğrudan müşteri rotası</span><span>Kaynak para birimi</span></div>
            <h2>Müşteri seçin</h2>
            <p>Müşteri adına göre arayın; teklif sıklığını, durum örüntülerini, sorumlu personel geçmişini ve kronolojik teklif akışını açın.</p>
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
            <span>Müşteri ara</span>
            <input defaultValue={search} name="q" placeholder="Müşteri adı..." type="search" />
          </label>
          <button className="button primary" type="submit">Müşterileri Getir</button>
          <a className="button" href="/reports/customer-quotation-history">Temizle</a>
        </form>

        <section className="report-period-summary">
          <div><span className="eyebrow">Sonuç</span><strong>{numberFormatter.format(rows.length)} müşteri</strong></div>
          <div><span className="eyebrow">Arama</span><strong>{search || 'Son teklif tarihine göre güncel müşteriler'}</strong></div>
          <div><span className="eyebrow">Erişim</span><strong>Owner / Manager kapsam kontrollü</strong></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Müşteri dizini</span><h3>Teklif geçmişini aç</h3></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Müşteri</th><th>Teklif</th><th>Personel</th><th>İlk teklif</th><th>Son teklif</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.customerId}>
                    <td><strong>{row.displayName}</strong><small className="table-subtitle">Odoo müşteri #{row.customerId}</small></td>
                    <td>{numberFormatter.format(row.quotationCount)}</td>
                    <td>{numberFormatter.format(row.salespersonCount)}</td>
                    <td>{formatDate(row.firstQuotationDate)}</td>
                    <td>{formatDate(row.lastQuotationDate)}</td>
                    <td><a className="button primary" href={`/reports/customer-quotation-history/${row.customerId}?businessUnitId=${encodeURIComponent(businessUnitId)}`}>Geçmişi Aç</a></td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={6}>Arama ölçütüne uyan müşteri bulunamadı.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
