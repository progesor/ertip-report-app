import Link from 'next/link';

import type {
  NullableMetricChange,
  QuotationConversionReportResult,
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

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Henüz yok';
}

function formatMonth(value: string): string {
  return monthFormatter.format(new Date(`${value}-01T00:00:00.000Z`));
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDecimal(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${oneDecimalFormatter.format(value)}${suffix}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${oneDecimalFormatter.format(value * 100)}`;
}

function changeText(change: { readonly absolute: number; readonly percent: number | null }): string {
  const sign = change.absolute > 0 ? '+' : '';
  const percent = change.percent === null ? 'baz yok' : `${sign}${oneDecimalFormatter.format(change.percent * 100)}%`;
  return `${sign}${formatDecimal(change.absolute)} · ${percent}`;
}

function nullableChangeText(change: NullableMetricChange): string {
  if (change.absolute === null) return 'Karşılaştırma yok';
  const sign = change.absolute > 0 ? '+' : '';
  const percent = change.percent === null ? 'baz yok' : `${sign}${oneDecimalFormatter.format(change.percent * 100)}%`;
  return `${sign}${oneDecimalFormatter.format(change.absolute)} gün · ${percent}`;
}

function relationLabel(value: string): string {
  if (value === 'same_month') return 'Aynı ay';
  if (value === 'cross_month') return 'Sonraki ay';
  if (value === 'anomaly') return 'Kaynak anomalisi';
  return 'Dönüşmedi';
}

function relationTone(value: string): string {
  if (value === 'same_month') return 'green';
  if (value === 'cross_month') return 'amber';
  if (value === 'anomaly') return 'red';
  return 'muted';
}

function createReportHref(
  result: QuotationConversionReportResult,
  overrides: Readonly<Record<string, string | null>> = {},
): string {
  const params = new URLSearchParams({
    businessUnitId: result.filters.businessUnitId,
    dateFrom: result.filters.dateFrom,
    dateTo: result.filters.dateTo,
  });
  if (result.filters.salespersonId !== null) params.set('salespersonId', String(result.filters.salespersonId));
  if (result.filters.customerId !== null) params.set('customerId', String(result.filters.customerId));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  }
  return `/reports/quotation-conversion?${params.toString()}`;
}

function createExportHref(result: QuotationConversionReportResult): string {
  const query = createReportHref(result).split('?')[1] ?? '';
  return `/api/reports/quotation-conversion/export?format=xlsx&${query}`;
}

export function QuotationConversionReportView({
  result,
  user,
  demoMode,
}: Readonly<{
  result: QuotationConversionReportResult;
  user: ReportUser;
  demoMode: boolean;
}>) {
  const selectedSalesperson =
    result.filters.salespersonId === null
      ? null
      : result.options.salespeople.find(({ id }) => id === result.filters.salespersonId)?.displayName;
  const selectedCustomer =
    result.filters.customerId === null
      ? null
      : result.options.customers.find(({ id }) => id === result.filters.customerId)?.displayName;
  const activeFilters = [selectedSalesperson, selectedCustomer].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <div className="app-shell report-app-shell">
      <aside className="sidebar report-sidebar">
        <Link className="brand" href="/"><b>ER</b><div><strong>Ertip Report</strong><span>Executive Intelligence</span></div></Link>
        <nav aria-label="Rapor navigasyonu">
          <small>Raporlar</small>
          <Link className="nav-item" href="/reports/monthly-quotation-performance"><i>1</i>Aylık Performans</Link>
          <Link className="nav-item" href="/reports/open-aging-quotations"><i>2</i>Yaşlanan Teklifler</Link>
          <Link className="nav-item" href="/reports/customer-quotation-history"><i>3</i>Müşteri Geçmişi</Link>
          <Link className="nav-item" href="/reports/personnel-performance"><i>4</i>Personel Performansı</Link>
          <Link className="nav-item active" href="/reports/quotation-conversion"><i>5</i>Teklif Dönüşümü</Link>
        </nav>
        <div className="sidebar-footer"><span className="status online" /><div><strong>{result.businessUnit.displayName}</strong><small>Son senkron: {formatDateTime(result.lastSyncAt)}</small></div></div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div><span className="eyebrow">M5.4 · İkinci zaman ekseni</span><h1>Tekliften Siparişe Dönüşüm</h1></div>
          <div className="user-menu"><div><strong>{user.displayName}</strong><span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span></div><Link className="button" href="/">Panele dön</Link></div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges"><span>{result.businessUnit.displayName}</span><span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span><span>create_date kohortu</span><span>v{result.definition.version}</span></div>
            <h2>Teklif kohortlarının satışa dönüşme hızı</h2>
            <p>Teklifleri oluşturuldukları döneme göre kohortlar; yalnızca satışa dönen kayıtlarda Odoo <code>date_order</code> alanını gerçekleşme zamanı olarak kullanır. Aynı ay, çapraz ay, gecikme günleri ve kaynak anomalileri ayrı gösterilir.</p>
          </div>
          <div className="report-heading-actions no-print"><Link className="button" href="/reports/monthly-quotation-performance">Aylık Rapora Git</Link><a className="button primary" href={createExportHref(result)}>Excel Dönüşüm Çıktısı</a></div>
        </section>

        <form className="report-filters no-print" method="get">
          <label><span>İş birimi</span><select defaultValue={result.filters.businessUnitId} name="businessUnitId">{result.options.businessUnits.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Başlangıç</span><input defaultValue={result.filters.dateFrom} name="dateFrom" type="date" /></label>
          <label><span>Bitiş (hariç)</span><input defaultValue={result.filters.dateTo} name="dateTo" type="date" /></label>
          <label><span>Personel</span><select defaultValue={result.filters.salespersonId ?? ''} name="salespersonId"><option value="">Tüm personel</option>{result.options.salespeople.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Müşteri</span><select defaultValue={result.filters.customerId ?? ''} name="customerId"><option value="">Tüm müşteriler</option>{result.options.customers.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <button className="button primary" type="submit">Raporu Çalıştır</button>
          <Link className="button" href={`/reports/quotation-conversion?businessUnitId=${encodeURIComponent(result.filters.businessUnitId)}`}>Temizle</Link>
        </form>

        <section className="report-period-summary">
          <div><span className="eyebrow">Teklif kohortu</span><strong>{formatDate(result.filters.dateFrom)} – {formatDate(result.filters.dateTo)}</strong></div>
          <div><span className="eyebrow">Önceki kohort</span><strong>{formatDate(result.previousPeriod.dateFrom)} – {formatDate(result.previousPeriod.dateTo)}</strong></div>
          <div><span className="eyebrow">Aktif filtre</span><strong>{activeFilters.length === 0 ? 'Tüm personel ve müşteriler' : activeFilters.join(' · ')}</strong></div>
          <div><span className="eyebrow">Kaynak anomalisi</span><strong>{formatNumber(result.anomalies.totalCount)} kayıt</strong></div>
        </section>

        <section className="report-kpi-grid" aria-label="Dönüşüm performans göstergeleri">
          <article className="report-kpi cyan"><span>Teklif Kohortu</span><strong>{formatNumber(result.metrics.quotationCount)}</strong><small>{changeText(result.changes.quotationCount)}</small><p>Seçili create_date aralığında üretilen teklifler.</p></article>
          <article className="report-kpi green"><span>Siparişe Dönüşen</span><strong>{formatNumber(result.metrics.convertedCount)}</strong><small>{changeText(result.changes.convertedCount)}</small><p>Odoo durumu sale olan kayıtlar.</p></article>
          <article className="report-kpi green"><span>Adet Dönüşümü</span><strong>{formatPercent(result.metrics.conversionRate)}</strong><small>{changeText(result.changes.conversionRate)}</small><p>Kohortun siparişe dönüşme oranı.</p></article>
          <article className="report-kpi amber"><span>Medyan Dönüşüm</span><strong>{formatDecimal(result.metrics.medianLagDays, ' gün')}</strong><small>{nullableChangeText(result.changes.medianLagDays)}</small><p>Negatif/anormal tarihler hesap dışıdır.</p></article>
          <article className="report-kpi cyan"><span>Aynı Ay Dönüşen</span><strong>{formatNumber(result.metrics.sameMonthConvertedCount)}</strong><small>{formatPercent(result.metrics.sameMonthShareOfConverted)}</small><p>Teklif ve sipariş ayı aynı olanlar.</p></article>
          <article className="report-kpi amber"><span>Çapraz Ay Dönüşen</span><strong>{formatNumber(result.metrics.crossMonthConvertedCount)}</strong><small>{formatPercent(result.metrics.crossMonthShareOfConverted)}</small><p>Sonraki ay veya aylarda gerçekleşenler.</p></article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Dönüşüm hızı</span><h3>Gecikme Günleri Dağılımı</h3></div><small>Paylar yalnızca satışa dönen tekliflere göredir.</small></div>
          <div className="table-wrap"><table><thead><tr><th>Aralık</th><th>Kayıt</th><th>Dönüşen içindeki pay</th></tr></thead><tbody>{result.lagDistribution.map((row) => <tr key={row.code}><td><strong>{row.label}</strong></td><td>{formatNumber(row.count)}</td><td>{formatPercent(row.shareOfConverted)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="analytics-grid">
          <article className="panel table-panel">
            <div className="panel-title"><div><span className="eyebrow">6 aylık kohort</span><h3>Aylık Dönüşüm Eğilimi</h3></div></div>
            <div className="table-wrap"><table><thead><tr><th>Ay</th><th>Teklif</th><th>Dönüşen</th><th>Dönüşüm</th><th>Medyan gün</th><th>Çapraz ay</th></tr></thead><tbody>{result.trend.map((row) => <tr key={row.month}><td>{formatMonth(row.month)}</td><td>{formatNumber(row.metrics.quotationCount)}</td><td className="green-text">{formatNumber(row.metrics.convertedCount)}</td><td>{formatPercent(row.metrics.conversionRate)}</td><td>{formatDecimal(row.metrics.medianLagDays, ' gün')}</td><td>{formatNumber(row.metrics.crossMonthConvertedCount)}</td></tr>)}</tbody></table></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">Veri kalitesi</span><h3>Gerçekleşme Tarihi Anomalileri</h3></div></div>
            <p><strong>{formatNumber(result.anomalies.totalCount)}</strong> satış kaydı normal gecikme istatistiklerinden ayrıldı.</p>
            <ul><li>Tekliften önce gerçekleşme tarihi: <b>{formatNumber(result.anomalies.confirmationBeforeQuotationCount)}</b></li><li>Geçersiz gerçekleşme tarihi: <b>{formatNumber(result.anomalies.invalidConfirmationDateCount)}</b></li></ul>
            <p>Bu kayıtlar dönüşen adet içinde kalır; ancak ortalama, medyan ve yüzdelik gün hesaplarını bozmaz.</p>
          </article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Ekip kırılımı</span><h3>Personel Dönüşüm Karşılaştırması</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Personel</th><th>Teklif</th><th>Dönüşen</th><th>Dönüşüm</th><th>Medyan gün</th><th>Aynı ay</th><th>Çapraz ay</th><th>Anomali</th></tr></thead><tbody>{result.salespeople.map((row) => <tr key={`${row.id}:${row.displayName}`}><td><strong>{row.displayName}</strong></td><td>{formatNumber(row.metrics.quotationCount)}</td><td className="green-text">{formatNumber(row.metrics.convertedCount)}</td><td>{formatPercent(row.metrics.conversionRate)}</td><td>{formatDecimal(row.metrics.medianLagDays, ' gün')}</td><td>{formatNumber(row.metrics.sameMonthConvertedCount)}</td><td>{formatNumber(row.metrics.crossMonthConvertedCount)}</td><td className={row.metrics.anomalyCount > 0 ? 'red-text' : ''}>{formatNumber(row.metrics.anomalyCount)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Müşteri kırılımı</span><h3>Müşteri Dönüşüm Karşılaştırması</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Müşteri</th><th>Teklif</th><th>Dönüşen</th><th>Dönüşüm</th><th>Medyan gün</th><th>Çapraz ay</th></tr></thead><tbody>{result.customers.map((row) => <tr key={`${row.id}:${row.displayName}`}><td><strong>{row.displayName}</strong></td><td>{formatNumber(row.metrics.quotationCount)}</td><td className="green-text">{formatNumber(row.metrics.convertedCount)}</td><td>{formatPercent(row.metrics.conversionRate)}</td><td>{formatDecimal(row.metrics.medianLagDays, ' gün')}</td><td>{formatNumber(row.metrics.crossMonthConvertedCount)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><span className="eyebrow">Kohort detayı</span><h3>Teklif ve Gerçekleşme Zamanları</h3></div><small>{formatNumber(result.detailTotalCount)} kayıt{result.detailsTruncated ? ` · ilk ${formatNumber(result.detailLimit)} gösteriliyor` : ''}</small></div>
          <div className="table-wrap"><table><thead><tr><th>Odoo ID</th><th>Teklif tarihi</th><th>Gerçekleşme tarihi</th><th>Personel</th><th>Müşteri</th><th>Sonuç</th><th>Gecikme</th><th>Ay ilişkisi</th><th>Para birimi</th></tr></thead><tbody>{result.details.map((row) => <tr key={row.id}><td>#{row.id}</td><td>{formatDate(row.createDate)}</td><td>{row.converted ? formatDate(row.dateOrder) : '—'}</td><td>{row.salespersonName}</td><td>{row.customerName}</td><td><span className={`status-pill ${row.converted ? 'green' : 'muted'}`}>{row.converted ? 'Sipariş' : 'Dönüşmedi'}</span></td><td>{row.lagDays === null ? '—' : `${formatNumber(row.lagDays)} gün`}</td><td><span className={`status-pill ${relationTone(row.dateRelation)}`}>{relationLabel(row.dateRelation)}</span></td><td>{row.currencyCode}</td></tr>)}{result.details.length === 0 ? <tr><td colSpan={9}>Seçili filtrelerde kayıt bulunamadı.</td></tr> : null}</tbody></table></div>
        </section>

        <footer><span className="status online" />Kohort ekseni: create_date · gerçekleşme ekseni: state=sale için date_order · üretim {formatDateTime(result.generatedAt)}</footer>
      </main>
    </div>
  );
}
