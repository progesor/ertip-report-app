import type { CustomerQuotationHistoryReportResult } from '@ertip/reporting';

interface ReportUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

const numberFormatter = new Intl.NumberFormat('tr-TR');
const oneDecimalFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusLabels: Readonly<Record<string, string>> = {
  all: 'Tüm durumlar',
  realized: 'Gerçekleşti',
  open: 'Açık',
  not_realized: 'Gerçekleşmedi',
  expired: 'Süresi doldu',
  cancelled: 'İptal',
  unknown: 'Bilinmiyor',
};

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Henüz yok';
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${oneDecimalFormatter.format(value * 100)}`;
}

function formatDecimal(value: number | null): string {
  return value === null ? '—' : oneDecimalFormatter.format(value);
}

function formatMoney(value: string, currencyCode: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function statusTone(value: string): string {
  if (value === 'realized') return 'green';
  if (value === 'open') return 'amber';
  if (value === 'expired' || value === 'cancelled') return 'red';
  return 'muted';
}

function createReportHref(
  result: CustomerQuotationHistoryReportResult,
  overrides: Readonly<Record<string, string | null>> = {},
): string {
  const params = new URLSearchParams({
    businessUnitId: result.filters.businessUnitId,
    dateFrom: result.filters.dateFrom,
    dateTo: result.filters.dateTo,
    status: result.filters.status,
  });
  if (result.filters.salespersonId !== null) {
    params.set('salespersonId', String(result.filters.salespersonId));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  }
  return `/reports/customer-quotation-history/${result.customer.id}?${params.toString()}`;
}

function createExportHref(result: CustomerQuotationHistoryReportResult): string {
  const query = createReportHref(result).split('?')[1] ?? '';
  return `/api/reports/customer-quotation-history/${result.customer.id}/export?format=xlsx&${query}`;
}

export function CustomerQuotationHistoryReportView({
  result,
  user,
  demoMode,
}: Readonly<{
  result: CustomerQuotationHistoryReportResult;
  user: ReportUser;
  demoMode: boolean;
}>) {
  const selectedSalesperson =
    result.filters.salespersonId === null
      ? null
      : result.options.salespeople.find(({ id }) => id === result.filters.salespersonId)?.displayName;
  const activeFilters = [
    selectedSalesperson,
    result.filters.status === 'all' ? null : statusLabels[result.filters.status],
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="app-shell report-app-shell">
      <aside className="sidebar report-sidebar">
        <a className="brand" href="/"><b>ER</b><div><strong>Ertip Report</strong><span>Executive Intelligence</span></div></a>
        <nav aria-label="Rapor navigasyonu">
          <small>Raporlar</small>
          <a className="nav-item" href="/reports/monthly-quotation-performance"><i>1</i>Aylık Performans</a>
          <a className="nav-item" href="/reports/open-aging-quotations"><i>2</i>Yaşlanan Teklifler</a>
          <a className="nav-item active" href="/reports/customer-quotation-history"><i>3</i>Müşteri Geçmişi</a>
          <small className="nav-heading">Aktif müşteri</small>
          <span className="sidebar-report-name">{result.customer.displayName}</span>
        </nav>
        <div className="sidebar-footer"><span className="status online" /><div><strong>{result.businessUnit.displayName}</strong><small>Son senkron: {formatDateTime(result.lastSyncAt)}</small></div></div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div><span className="eyebrow">M5.2 · Müşteri analizi</span><h1>Müşteri Teklif Geçmişi</h1></div>
          <div className="user-menu"><div><strong>{user.displayName}</strong><span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span></div><a className="button" href="/">Panele dön</a></div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges"><span>{result.businessUnit.displayName}</span><span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span><span>Odoo #{result.customer.id}</span><span>v{result.definition.version}</span></div>
            <h2>{result.customer.displayName}</h2>
            <p>Teklif sıklığını, gerçekleşme örüntülerini, sorumlu personel değişimini ve kronolojik teklif akışını kaynak para birimini koruyarak gösterir.</p>
          </div>
          <div className="report-heading-actions no-print"><a className="button" href="/reports/customer-quotation-history">Başka Müşteri</a><a className="button primary" href={createExportHref(result)}>Excel Detay Çıktısı</a></div>
        </section>

        <form className="report-filters no-print" method="get">
          <input name="businessUnitId" type="hidden" value={result.filters.businessUnitId} />
          <label><span>Başlangıç</span><input defaultValue={result.filters.dateFrom} name="dateFrom" type="date" /></label>
          <label><span>Bitiş (hariç)</span><input defaultValue={result.filters.dateTo} name="dateTo" type="date" /></label>
          <label><span>Personel</span><select defaultValue={result.filters.salespersonId ?? ''} name="salespersonId"><option value="">Tüm personel</option>{result.options.salespeople.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Durum</span><select defaultValue={result.filters.status} name="status">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="button primary" type="submit">Raporu Çalıştır</button><a className="button" href={`/reports/customer-quotation-history/${result.customer.id}?businessUnitId=${encodeURIComponent(result.filters.businessUnitId)}`}>Temizle</a>
        </form>

        <section className="report-period-summary">
          <div><span className="eyebrow">Dönem</span><strong>{formatDate(result.filters.dateFrom)} – {formatDate(result.filters.dateTo)}</strong></div>
          <div><span className="eyebrow">Tüm zamanlar</span><strong>{numberFormatter.format(result.allTime.quotationCount)} teklif</strong></div>
          <div><span className="eyebrow">Aktif filtre</span><strong>{activeFilters.length === 0 ? 'Tüm durumlar ve personel' : activeFilters.join(' · ')}</strong></div>
          <div><span className="eyebrow">Son veri senkronizasyonu</span><strong>{formatDateTime(result.lastSyncAt)}</strong></div>
        </section>

        <section className="report-kpi-grid" aria-label="Müşteri teklif geçmişi göstergeleri">
          <article className="report-kpi cyan"><span>Dönem Teklifleri</span><strong>{numberFormatter.format(result.metrics.quotationCount)}</strong><small>İlk: {formatDate(result.period.firstQuotationDate)}</small><p>Seçili filtrelerdeki teklif nüfusu.</p></article>
          <article className="report-kpi green"><span>Gerçekleşen</span><strong>{numberFormatter.format(result.metrics.realizedCount)}</strong><small>{formatPercent(result.metrics.conversionRate)} dönüşüm</small><p>Kaynak durumu sale olan teklifler.</p></article>
          <article className="report-kpi amber"><span>Açık</span><strong>{numberFormatter.format(result.metrics.openCount)}</strong><small>Güncel açık nüfus</small><p>Taslak/gönderilmiş ve süresi dolmamış teklifler.</p></article>
          <article className="report-kpi red"><span>Gerçekleşmeyen</span><strong>{numberFormatter.format(result.metrics.notRealizedCount)}</strong><small>İptal + süresi dolmuş</small><p>Kanonik gerçekleşmeyen sunum grubu.</p></article>
          <article className="report-kpi cyan"><span>Tekrar Teklif</span><strong>{numberFormatter.format(result.repeat.repeatQuotationCount)}</strong><small>{formatDecimal(result.repeat.averageDaysBetweenQuotations)} gün ortalama</small><p>İlk teklif sonrası tekrar temas sayısı.</p></article>
          <article className="report-kpi amber"><span>Aktif Ay</span><strong>{numberFormatter.format(result.repeat.activeMonthCount)}</strong><small>{formatDecimal(result.repeat.quotationsPerActiveMonth)} teklif/ay</small><p>Teklif üretilen farklı ay sayısı.</p></article>
        </section>

        <section className="analytics-grid">
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Durum örüntüsü</span><h3>Teklif Durum Dağılımı</h3></div></div>
            <div className="table-wrap"><table><thead><tr><th>Durum</th><th>Teklif</th><th>Pay</th></tr></thead><tbody>{result.statusDistribution.map((row) => <tr key={row.status}><td><span className={`status-pill ${statusTone(row.status)}`}>{row.label}</span></td><td>{numberFormatter.format(row.count)}</td><td>{formatPercent(row.share)}</td></tr>)}</tbody></table></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Tekrar davranışı</span><h3>İletişim Ritmi</h3></div></div>
            <div className="report-period-summary" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div><span className="eyebrow">İlk teklif</span><strong>{formatDate(result.allTime.firstQuotationDate)}</strong></div>
              <div><span className="eyebrow">Son teklif</span><strong>{formatDate(result.allTime.lastQuotationDate)}</strong></div>
              <div><span className="eyebrow">Medyan aralık</span><strong>{formatDecimal(result.repeat.medianDaysBetweenQuotations)} gün</strong></div>
              <div><span className="eyebrow">Para birimleri</span><strong>{result.currencies.map(({ currencyCode, quotationCount }) => `${currencyCode} ${quotationCount}`).join(' · ') || '—'}</strong></div>
            </div>
          </article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Sahiplik geçmişi</span><h3>Atanan Personeller</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Personel</th><th>Teklif</th><th>Gerçekleşen</th><th>Açık</th><th>Gerçekleşmeyen</th><th>Dönüşüm</th><th>İlk</th><th>Son</th></tr></thead><tbody>{result.salespersonHistory.map((row) => <tr key={row.salespersonId ?? 'unassigned'}><td><strong>{row.displayName}</strong><small className="table-subtitle">{row.salespersonId === null ? 'Atanmamış' : `Odoo #${row.salespersonId}`}</small></td><td>{row.metrics.quotationCount}</td><td className="green-text">{row.metrics.realizedCount}</td><td className="amber-text">{row.metrics.openCount}</td><td className="red-text">{row.metrics.notRealizedCount}</td><td>{formatPercent(row.metrics.conversionRate)}</td><td>{formatDate(row.firstQuotationDate)}</td><td>{formatDate(row.lastQuotationDate)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="analytics-grid">
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Aylık sıklık</span><h3>Teklif Frekansı</h3></div></div>
            <div className="table-wrap"><table><thead><tr><th>Ay</th><th>Teklif</th><th>Gerçekleşen</th><th>Açık</th><th>Gerçekleşmeyen</th></tr></thead><tbody>{result.monthlyFrequency.map((row) => <tr key={row.month}><td>{row.month}</td><td>{row.metrics.quotationCount}</td><td className="green-text">{row.metrics.realizedCount}</td><td className="amber-text">{row.metrics.openCount}</td><td className="red-text">{row.metrics.notRealizedCount}</td></tr>)}</tbody></table></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Ardışık teklifler</span><h3>Durum Geçişleri</h3></div></div>
            <div className="table-wrap"><table><thead><tr><th>Önceki</th><th>Sonraki</th><th>Tekrar</th></tr></thead><tbody>{result.transitions.map((row) => <tr key={`${row.from}-${row.to}`}><td>{statusLabels[row.from]}</td><td>{statusLabels[row.to]}</td><td>{row.count}</td></tr>)}{result.transitions.length === 0 ? <tr><td colSpan={3}>Geçiş oluşturacak kadar tekrar teklif yok.</td></tr> : null}</tbody></table></div>
          </article>
        </section>

        <section className="panel table-panel" id="teklif-zaman-cizelgesi">
          <div className="panel-title"><div><span className="eyebrow">Kronolojik kayıt</span><h3>Teklif Zaman Çizelgesi</h3></div><span>{numberFormatter.format(result.timelineTotalCount)} kayıt</span></div>
          <div className="table-wrap"><table><thead><tr><th>Tarih</th><th>Odoo ID</th><th>Personel</th><th>Durum</th><th>Önceki teklife gün</th><th>Geçerlilik</th><th>Tutar</th></tr></thead><tbody>{result.timeline.map((row) => <tr key={row.id}><td>{formatDateTime(row.createDate)}</td><td>#{row.id}</td><td>{row.salespersonName}</td><td><span className={`status-pill ${statusTone(row.normalizedStatus)}`}>{statusLabels[row.normalizedStatus]}</span></td><td>{row.daysSincePreviousQuotation ?? '—'}</td><td>{formatDate(row.validityDate)}</td><td>{formatMoney(row.amountTotal, row.currencyCode)}</td></tr>)}{result.timeline.length === 0 ? <tr><td colSpan={7}>Seçili filtrelerde teklif bulunamadı.</td></tr> : null}</tbody></table></div>
          {result.timelineTruncated ? <p>İlk {numberFormatter.format(result.timelineLimit)} kayıt gösteriliyor. Excel çıktısı tam filtrelenmiş nüfusu içerir.</p> : null}
        </section>
      </main>
    </div>
  );
}
