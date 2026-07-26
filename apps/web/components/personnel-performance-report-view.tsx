import Link from 'next/link';

import type {
  CurrencyAmountMetrics,
  PersonnelPerformanceReportResult,
} from '@ertip/reporting';

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
const monthFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'UTC',
  month: 'short',
  year: 'numeric',
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

function formatMonth(value: string): string {
  return monthFormatter.format(new Date(`${value}-01T00:00:00.000Z`));
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${oneDecimalFormatter.format(value * 100)}`;
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatMoney(value: string, currencyCode: string): string {
  const number = Number(value);
  if (!Number.isFinite(number) || currencyCode === 'XXX') {
    return `${value} ${currencyCode}`;
  }
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${value} ${currencyCode}`;
  }
}

function changeText(change: { readonly absolute: number; readonly percent: number | null }): string {
  const sign = change.absolute > 0 ? '+' : '';
  const percent = change.percent === null ? 'baz yok' : `${sign}${oneDecimalFormatter.format(change.percent * 100)}%`;
  return `${sign}${formatNumber(change.absolute)} · ${percent}`;
}

function amountChangeText(change: { readonly absolute: string; readonly percent: number | null }, currencyCode: string): string {
  const percent = change.percent === null ? 'baz yok' : `${change.percent > 0 ? '+' : ''}${oneDecimalFormatter.format(change.percent * 100)}%`;
  return `${formatMoney(change.absolute, currencyCode)} · ${percent}`;
}

function amountSummary(amounts: readonly CurrencyAmountMetrics[], field: 'quotationAmount' | 'realizedAmount'): string {
  return amounts.map((row) => formatMoney(row[field], row.currencyCode)).join(' · ') || '—';
}

function statusTone(value: string): string {
  if (value === 'realized') return 'green';
  if (value === 'open') return 'amber';
  if (value === 'expired' || value === 'cancelled') return 'red';
  return 'muted';
}

function createReportHref(
  result: PersonnelPerformanceReportResult,
  overrides: Readonly<Record<string, string | null>> = {},
): string {
  const params = new URLSearchParams({
    businessUnitId: result.filters.businessUnitId,
    dateFrom: result.filters.dateFrom,
    dateTo: result.filters.dateTo,
    status: result.filters.status,
  });
  if (result.filters.customerId !== null) {
    params.set('customerId', String(result.filters.customerId));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  }
  return `/reports/personnel-performance/${result.salesperson.id}?${params.toString()}`;
}

function createExportHref(result: PersonnelPerformanceReportResult): string {
  const query = createReportHref(result).split('?')[1] ?? '';
  return `/api/reports/personnel-performance/${result.salesperson.id}/export?format=xlsx&${query}`;
}

function createMonthlyDrilldownHref(result: PersonnelPerformanceReportResult): string {
  const params = new URLSearchParams({
    businessUnitId: result.filters.businessUnitId,
    dateFrom: result.filters.dateFrom,
    dateTo: result.filters.dateTo,
    salespersonId: String(result.salesperson.id),
    status: result.filters.status,
    view: 'salesperson',
  });
  if (result.filters.customerId !== null) params.set('customerId', String(result.filters.customerId));
  return `/reports/monthly-quotation-performance?${params.toString()}`;
}

export function PersonnelPerformanceReportView({
  result,
  user,
  demoMode,
}: Readonly<{
  result: PersonnelPerformanceReportResult;
  user: ReportUser;
  demoMode: boolean;
}>) {
  const selectedCustomer =
    result.filters.customerId === null
      ? null
      : result.options.customers.find(({ id }) => id === result.filters.customerId)?.displayName;
  const activeFilters = [
    selectedCustomer,
    result.filters.status === 'all' ? null : statusLabels[result.filters.status],
  ].filter((value): value is string => Boolean(value));

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
          <small className="nav-heading">Aktif personel</small>
          <span className="sidebar-report-name">{result.salesperson.displayName}</span>
        </nav>
        <div className="sidebar-footer"><span className="status online" /><div><strong>{result.businessUnit.displayName}</strong><small>Son senkron: {formatDateTime(result.lastSyncAt)}</small></div></div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div><span className="eyebrow">M5.3 · Personel analizi</span><h1>Personel Performansı</h1></div>
          <div className="user-menu"><div><strong>{user.displayName}</strong><span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span></div><Link className="button" href="/">Panele dön</Link></div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges"><span>{result.businessUnit.displayName}</span><span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span><span>Odoo #{result.salesperson.id}</span><span>v{result.definition.version}</span></div>
            <h2>{result.salesperson.displayName}</h2>
            <p>Teklif üretimi, gerçekleşen satış, müşteri kapsamı, ekip medyanı ve kaynak para birimi bazlı tutar performansını aynı kanonik kayıt nüfusundan gösterir.</p>
          </div>
          <div className="report-heading-actions no-print"><Link className="button" href="/reports/personnel-performance">Başka Personel</Link><Link className="button" href={createMonthlyDrilldownHref(result)}>Aylık Detaya Git</Link><a className="button primary" href={createExportHref(result)}>Excel Performans Çıktısı</a></div>
        </section>

        <form className="report-filters no-print" method="get">
          <input name="businessUnitId" type="hidden" value={result.filters.businessUnitId} />
          <label><span>Başlangıç</span><input defaultValue={result.filters.dateFrom} name="dateFrom" type="date" /></label>
          <label><span>Bitiş (hariç)</span><input defaultValue={result.filters.dateTo} name="dateTo" type="date" /></label>
          <label><span>Müşteri</span><select defaultValue={result.filters.customerId ?? ''} name="customerId"><option value="">Tüm müşteriler</option>{result.options.customers.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Durum</span><select defaultValue={result.filters.status} name="status">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="button primary" type="submit">Raporu Çalıştır</button>
          <Link className="button" href={`/reports/personnel-performance/${result.salesperson.id}?businessUnitId=${encodeURIComponent(result.filters.businessUnitId)}`}>Temizle</Link>
        </form>

        <section className="report-period-summary">
          <div><span className="eyebrow">Seçili dönem</span><strong>{formatDate(result.filters.dateFrom)} – {formatDate(result.filters.dateTo)}</strong></div>
          <div><span className="eyebrow">Önceki dönem</span><strong>{formatDate(result.previousPeriod.dateFrom)} – {formatDate(result.previousPeriod.dateTo)}</strong></div>
          <div><span className="eyebrow">Aktif filtre</span><strong>{activeFilters.length === 0 ? 'Tüm müşteriler ve durumlar' : activeFilters.join(' · ')}</strong></div>
          <div><span className="eyebrow">Ekip karşılaştırması</span><strong>{formatNumber(result.teamComparison.activeMemberCount)} aktif personel</strong></div>
        </section>

        <section className="report-kpi-grid" aria-label="Personel performans göstergeleri">
          <article className="report-kpi cyan"><span>Toplam Teklif</span><strong>{formatNumber(result.metrics.quotationCount)}</strong><small>{changeText(result.changes.quotationCount)}</small><p>Ekip medyanı {oneDecimalFormatter.format(result.teamComparison.median.quotationCount)} · sıra #{result.teamComparison.quotationRank}</p></article>
          <article className="report-kpi green"><span>Gerçekleşen Satış</span><strong>{formatNumber(result.metrics.realizedCount)}</strong><small>{changeText(result.changes.realizedCount)}</small><p>Ekip medyanı {oneDecimalFormatter.format(result.teamComparison.median.realizedCount)} · sıra #{result.teamComparison.realizedRank}</p></article>
          <article className="report-kpi amber"><span>Açık Teklif</span><strong>{formatNumber(result.metrics.openCount)}</strong><small>{changeText(result.changes.openCount)}</small><p>Halen açık teklif nüfusu.</p></article>
          <article className="report-kpi red"><span>Gerçekleşmeyen</span><strong>{formatNumber(result.metrics.notRealizedCount)}</strong><small>{changeText(result.changes.notRealizedCount)}</small><p>İptal + süresi dolmuş teklifler.</p></article>
          <article className="report-kpi cyan"><span>Müşteri Kapsamı</span><strong>{formatNumber(result.metrics.quotedCustomerCount)}</strong><small>{changeText(result.changes.quotedCustomerCount)}</small><p>İlk 3 müşteri payı {formatPercent(result.concentration.topThreeCustomerShare)}.</p></article>
          <article className="report-kpi green"><span>Adet Dönüşümü</span><strong>{formatPercent(result.metrics.conversionRate)}</strong><small>{changeText(result.changes.conversionRate)}</small><p>Ekip medyanı {formatPercent(result.teamComparison.median.conversionRate)} · sıra #{result.teamComparison.conversionRank}</p></article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Rakam bazlı analiz</span><h3>Teklif ve Gerçekleşen Satış Tutarları</h3></div><small>Para birimleri dönüştürülmez ve birbirine eklenmez.</small></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Para birimi</th><th>Teklif tutarı</th><th>Önceki teklif</th><th>Teklif değişimi</th><th>Gerçekleşen satış</th><th>Önceki satış</th><th>Ekip medyanı satış</th><th>Tutar dönüşümü</th></tr></thead>
              <tbody>
                {result.currencies.map((row) => <tr key={row.currencyCode}><td><strong>{row.currencyCode}</strong></td><td>{formatMoney(row.current.quotationAmount, row.currencyCode)}</td><td>{formatMoney(row.previous.quotationAmount, row.currencyCode)}</td><td>{amountChangeText(row.changes.quotationAmount, row.currencyCode)}</td><td className="green-text">{formatMoney(row.current.realizedAmount, row.currencyCode)}</td><td>{formatMoney(row.previous.realizedAmount, row.currencyCode)}</td><td>{formatMoney(row.teamMedian.realizedAmount, row.currencyCode)}</td><td>{formatPercent(row.current.amountConversionRate)}</td></tr>)}
                {result.currencies.length === 0 ? <tr><td colSpan={8}>Seçili filtrelerde parasal kayıt bulunamadı.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="analytics-grid">
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Ekip kıyası</span><h3>Adet Bazlı Medyan</h3></div></div>
            <div className="table-wrap"><table><thead><tr><th>Gösterge</th><th>Personel</th><th>Ekip medyanı</th></tr></thead><tbody><tr><td>Teklif</td><td>{formatNumber(result.metrics.quotationCount)}</td><td>{oneDecimalFormatter.format(result.teamComparison.median.quotationCount)}</td></tr><tr><td>Gerçekleşen</td><td>{formatNumber(result.metrics.realizedCount)}</td><td>{oneDecimalFormatter.format(result.teamComparison.median.realizedCount)}</td></tr><tr><td>Açık</td><td>{formatNumber(result.metrics.openCount)}</td><td>{oneDecimalFormatter.format(result.teamComparison.median.openCount)}</td></tr><tr><td>Gerçekleşmeyen</td><td>{formatNumber(result.metrics.notRealizedCount)}</td><td>{oneDecimalFormatter.format(result.teamComparison.median.notRealizedCount)}</td></tr><tr><td>Müşteri</td><td>{formatNumber(result.metrics.quotedCustomerCount)}</td><td>{oneDecimalFormatter.format(result.teamComparison.median.quotedCustomerCount)}</td></tr></tbody></table></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Müşteri yoğunluğu</span><h3>Portföy Dağılımı</h3></div></div>
            <div className="report-period-summary" style={{ gridTemplateColumns: '1fr 1fr' }}><div><span className="eyebrow">Müşteri sayısı</span><strong>{formatNumber(result.concentration.customerCount)}</strong></div><div><span className="eyebrow">En büyük müşteri payı</span><strong>{formatPercent(result.concentration.topCustomerShare)}</strong></div><div><span className="eyebrow">İlk 3 müşteri payı</span><strong>{formatPercent(result.concentration.topThreeCustomerShare)}</strong></div><div><span className="eyebrow">Yorum</span><strong>{result.concentration.topThreeCustomerShare >= 0.75 ? 'Yüksek yoğunlaşma' : 'Dengeli dağılım'}</strong></div></div>
          </article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Altı aylık görünüm</span><h3>Aylık Eğilim</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Ay</th><th>Teklif</th><th>Gerçekleşen</th><th>Açık</th><th>Gerçekleşmeyen</th><th>Teklif tutarı</th><th>Satış tutarı</th></tr></thead><tbody>{result.trend.map((row) => <tr key={row.month}><td>{formatMonth(row.month)}</td><td>{formatNumber(row.metrics.quotationCount)}</td><td className="green-text">{formatNumber(row.metrics.realizedCount)}</td><td className="amber-text">{formatNumber(row.metrics.openCount)}</td><td className="red-text">{formatNumber(row.metrics.notRealizedCount)}</td><td>{amountSummary(row.amounts, 'quotationAmount')}</td><td className="green-text">{amountSummary(row.amounts, 'realizedAmount')}</td></tr>)}</tbody></table></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Portföy</span><h3>Müşteri Performansı ve Yoğunluğu</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Müşteri</th><th>Teklif</th><th>Gerçekleşen</th><th>Dönüşüm</th><th>Teklif payı</th><th>Teklif tutarı</th><th>Satış tutarı</th><th>Son teklif</th></tr></thead><tbody>{result.customers.map((row) => <tr key={row.customerId}><td><strong>{row.displayName}</strong><small className="table-subtitle">Odoo müşteri #{row.customerId}</small></td><td>{formatNumber(row.metrics.quotationCount)}</td><td className="green-text">{formatNumber(row.metrics.realizedCount)}</td><td>{formatPercent(row.metrics.conversionRate)}</td><td>{formatPercent(row.quotationShare)}</td><td>{amountSummary(row.amounts, 'quotationAmount')}</td><td className="green-text">{amountSummary(row.amounts, 'realizedAmount')}</td><td>{formatDate(row.lastQuotationDate)}</td></tr>)}{result.customers.length === 0 ? <tr><td colSpan={8}>Seçili filtrelerde müşteri kaydı bulunamadı.</td></tr> : null}</tbody></table></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Ekip görünümü</span><h3>Personel Karşılaştırması</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Personel</th><th>Teklif</th><th>Gerçekleşen</th><th>Açık</th><th>Gerçekleşmeyen</th><th>Müşteri</th><th>Dönüşüm</th><th>Satış tutarı</th><th /></tr></thead><tbody>{result.teamMembers.map((row) => <tr key={row.salespersonId}><td><strong>{row.displayName}</strong>{row.selected ? <small className="table-subtitle">Seçili personel</small> : null}</td><td>{formatNumber(row.metrics.quotationCount)}</td><td className="green-text">{formatNumber(row.metrics.realizedCount)}</td><td className="amber-text">{formatNumber(row.metrics.openCount)}</td><td className="red-text">{formatNumber(row.metrics.notRealizedCount)}</td><td>{formatNumber(row.customerCount)}</td><td>{formatPercent(row.metrics.conversionRate)}</td><td>{amountSummary(row.amounts, 'realizedAmount')}</td><td>{row.selected ? '—' : <Link className="button" href={`/reports/personnel-performance/${row.salespersonId}?businessUnitId=${encodeURIComponent(result.filters.businessUnitId)}&dateFrom=${result.filters.dateFrom}&dateTo=${result.filters.dateTo}`}>Aç</Link>}</td></tr>)}</tbody></table></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Doğrudan drill-down</span><h3>Teklif Detayı</h3></div><small>{formatNumber(result.detailTotalCount)} kayıt</small></div>
          <div className="table-wrap"><table><thead><tr><th>Tarih</th><th>Müşteri</th><th>Durum</th><th>Tutar</th><th>Para birimi</th><th>Geçerlilik</th><th>Odoo ID</th></tr></thead><tbody>{result.details.map((row) => <tr key={row.id}><td>{formatDate(row.createDate)}</td><td><strong>{row.customerName}</strong><small className="table-subtitle">Müşteri #{row.customerId}</small></td><td><span className={`status-pill ${statusTone(row.normalizedStatus)}`}>{statusLabels[row.normalizedStatus] ?? row.normalizedStatus}</span></td><td>{formatMoney(row.amountTotal, row.currencyCode)}</td><td>{row.currencyCode}</td><td>{formatDate(row.validityDate)}</td><td>#{row.id}</td></tr>)}{result.details.length === 0 ? <tr><td colSpan={7}>Seçili filtrelerde teklif bulunamadı.</td></tr> : null}</tbody></table></div>
          {result.detailsTruncated ? <p className="report-note">Ekran ilk {formatNumber(result.detailLimit)} kaydı gösteriyor. Excel çıktısı tüm filtreli kayıtları içerir.</p> : null}
        </section>
      </main>
    </div>
  );
}
