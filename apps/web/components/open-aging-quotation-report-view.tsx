import type {
  OpenAgingBucket,
  OpenAgingQuotationReportResult,
  OpenAgingValidityGroup,
} from '@ertip/reporting';

interface ReportUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

const numberFormatter = new Intl.NumberFormat('tr-TR');
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

const ageLabels: Readonly<Record<OpenAgingBucket, string>> = {
  '0_7': '0–7 gün',
  '8_14': '8–14 gün',
  '15_30': '15–30 gün',
  '31_60': '31–60 gün',
  '61_90': '61–90 gün',
  '90_plus': '90+ gün',
};

const validityLabels: Readonly<Record<OpenAgingValidityGroup, string>> = {
  valid: 'Geçerli',
  nearing_expiry: 'Süresi yaklaşan',
  overdue: 'Süresi dolmuş',
  missing: 'Geçerlilik tarihi eksik',
};

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Henüz yok';
}

function formatMoney(value: string, currencyCode: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function validityTone(value: OpenAgingValidityGroup): string {
  if (value === 'overdue') return 'red';
  if (value === 'nearing_expiry') return 'amber';
  if (value === 'valid') return 'green';
  return 'muted';
}

function expiryText(input: {
  readonly validityGroup: OpenAgingValidityGroup;
  readonly daysToExpiry: number | null;
}): string {
  if (input.validityGroup === 'missing') return 'Tarih eksik';
  if (input.daysToExpiry === null) return '—';
  if (input.daysToExpiry < 0) return `${formatNumber(Math.abs(input.daysToExpiry))} gün gecikmiş`;
  if (input.daysToExpiry === 0) return 'Bugün sona eriyor';
  return `${formatNumber(input.daysToExpiry)} gün kaldı`;
}

function createReportHref(
  result: OpenAgingQuotationReportResult,
  overrides: Readonly<Record<string, string | null>> = {},
): string {
  const params = new URLSearchParams({
    businessUnitId: result.filters.businessUnitId,
    ageBucket: result.filters.ageBucket,
    validityGroup: result.filters.validityGroup,
  });

  if (result.filters.salespersonId !== null) {
    params.set('salespersonId', String(result.filters.salespersonId));
  }
  if (result.filters.customerId !== null) {
    params.set('customerId', String(result.filters.customerId));
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  return `/reports/open-aging-quotations?${params.toString()}`;
}

function createExportHref(result: OpenAgingQuotationReportResult): string {
  const query = createReportHref(result).split('?')[1] ?? '';
  return `/api/reports/open-aging-quotations/export?format=xlsx&${query}`;
}

function SalespersonTable({ result }: Readonly<{ result: OpenAgingQuotationReportResult }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Personel</th><th>Takipte</th><th>Açık</th><th>Süresi dolmuş</th><th>Yaklaşan</th>
            <th>Tarih eksik</th><th>En yaşlı</th><th>Müşteri</th><th>Son teklif</th>
          </tr>
        </thead>
        <tbody>
          {result.salespeople.map((row) => (
            <tr key={row.salespersonId ?? 'unassigned'}>
              <td>
                {row.salespersonId === null ? (
                  <strong>{row.displayName}</strong>
                ) : (
                  <a href={createReportHref(result, { salespersonId: String(row.salespersonId) })}>
                    <strong>{row.displayName}</strong>
                  </a>
                )}
                <small className="table-subtitle">
                  {row.salespersonId === null ? 'Kaynakta personel atanmamış' : `Odoo #${row.salespersonId}`}
                </small>
              </td>
              <td>{formatNumber(row.metrics.trackedCount)}</td>
              <td className="green-text">{formatNumber(row.metrics.currentlyOpenCount)}</td>
              <td className="red-text">{formatNumber(row.metrics.overdueCount)}</td>
              <td className="amber-text">{formatNumber(row.metrics.nearingExpiryCount)}</td>
              <td>{formatNumber(row.metrics.missingValidityCount)}</td>
              <td>{formatNumber(row.metrics.oldestAgeDays)} gün</td>
              <td>{formatNumber(row.customerCount)}</td>
              <td>{formatDate(row.lastQuotationDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerTable({ result }: Readonly<{ result: OpenAgingQuotationReportResult }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Müşteri</th><th>Takipte</th><th>Açık</th><th>Süresi dolmuş</th><th>Yaklaşan</th>
            <th>Tarih eksik</th><th>En yaşlı</th><th>Personel</th><th>Son teklif</th>
          </tr>
        </thead>
        <tbody>
          {result.customers.map((row) => (
            <tr key={row.customerId}>
              <td>
                <a href={createReportHref(result, { customerId: String(row.customerId) })}>
                  <strong>{row.displayName}</strong>
                </a>
                <small className="table-subtitle">Odoo #{row.customerId}</small>
              </td>
              <td>{formatNumber(row.metrics.trackedCount)}</td>
              <td className="green-text">{formatNumber(row.metrics.currentlyOpenCount)}</td>
              <td className="red-text">{formatNumber(row.metrics.overdueCount)}</td>
              <td className="amber-text">{formatNumber(row.metrics.nearingExpiryCount)}</td>
              <td>{formatNumber(row.metrics.missingValidityCount)}</td>
              <td>{formatNumber(row.metrics.oldestAgeDays)} gün</td>
              <td>{formatNumber(row.salespersonCount)}</td>
              <td>{formatDate(row.lastQuotationDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpenAgingQuotationReportView({
  result,
  user,
  demoMode,
}: Readonly<{
  result: OpenAgingQuotationReportResult;
  user: ReportUser;
  demoMode: boolean;
}>) {
  const activeFilters = [
    result.filters.salespersonId === null
      ? null
      : result.options.salespeople.find(({ id }) => id === result.filters.salespersonId)?.displayName,
    result.filters.customerId === null
      ? null
      : result.options.customers.find(({ id }) => id === result.filters.customerId)?.displayName,
    result.filters.ageBucket === 'all' ? null : ageLabels[result.filters.ageBucket],
    result.filters.validityGroup === 'all' ? null : validityLabels[result.filters.validityGroup],
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="app-shell report-app-shell">
      <aside className="sidebar report-sidebar">
        <a className="brand" href="/"><b>ER</b><div><strong>Ertip Report</strong><span>Executive Intelligence</span></div></a>
        <nav aria-label="Rapor navigasyonu">
          <small>Çalışma Alanı</small>
          <a className="nav-item" href="/"><i>1</i>Genel Bakış</a>
          <a className="nav-item" href="/reports/monthly-quotation-performance"><i>2</i>Aylık Performans</a>
          <a className="nav-item active" href="/reports/open-aging-quotations"><i>3</i>Yaşlanan Teklifler</a>
          <small className="nav-heading">Aktif rapor</small>
          <span className="sidebar-report-name">Açık ve Yaşlanan Teklifler</span>
        </nav>
        <div className="sidebar-footer"><span className="status online" /><div><strong>{result.businessUnit.displayName}</strong><small>Son senkron: {formatDateTime(result.lastSyncAt)}</small></div></div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div><span className="eyebrow">Operasyonel Takip</span><h1>Yönetim Raporu</h1></div>
          <div className="user-menu"><div><strong>{user.displayName}</strong><span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span></div><a className="button" href="/">Panele dön</a></div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges"><span>{result.businessUnit.displayName}</span><span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span><span>Sunucu kapsamı</span><span>v{result.definition.version}</span></div>
            <h2>Açık ve Yaşlanan Teklifler</h2>
            <p>Sonuçlanmamış taslak ve gönderilmiş teklifleri yaş, geçerlilik, personel ve müşteri sahipliğiyle izler. Süresi dolmuş kayıtlar takip listesinde kalır.</p>
          </div>
          <div className="report-heading-actions no-print"><a className="button" href={createExportHref(result)}>Excel Takip Çıktısı</a><a className="button primary" href="#teklif-detayi">Teklif Detayı</a></div>
        </section>

        <section className="report-metadata print-only"><strong>{result.definition.name}</strong><span>Oluşturulma: {formatDateTime(result.generatedAt)}</span><span>Son senkronizasyon: {formatDateTime(result.lastSyncAt)}</span><span>Referans tarihi: {formatDate(result.asOfDate)}</span></section>

        <form className="report-filters no-print" method="get">
          <label><span>İş birimi</span><select defaultValue={result.filters.businessUnitId} name="businessUnitId">{result.options.businessUnits.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Personel</span><select defaultValue={result.filters.salespersonId ?? ''} name="salespersonId"><option value="">Tüm personel</option>{result.options.salespeople.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Müşteri</span><select defaultValue={result.filters.customerId ?? ''} name="customerId"><option value="">Tüm müşteriler</option>{result.options.customers.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
          <label><span>Teklif yaşı</span><select defaultValue={result.filters.ageBucket} name="ageBucket"><option value="all">Tüm yaşlar</option>{Object.entries(ageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Geçerlilik</span><select defaultValue={result.filters.validityGroup} name="validityGroup"><option value="all">Tüm gruplar</option>{Object.entries(validityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="button primary" type="submit">Raporu Çalıştır</button><a className="button" href="/reports/open-aging-quotations">Temizle</a>
        </form>

        <section className="report-period-summary">
          <div><span className="eyebrow">Referans tarihi</span><strong>{formatDate(result.asOfDate)}</strong></div>
          <div><span className="eyebrow">Son veri senkronizasyonu</span><strong>{formatDateTime(result.lastSyncAt)}</strong></div>
          <div><span className="eyebrow">Aktif filtre</span><strong>{activeFilters.length === 0 ? 'Tüm operasyonel kayıtlar' : activeFilters.join(' · ')}</strong></div>
          <div><span className="eyebrow">Detay sonucu</span><strong>{formatNumber(result.detailTotalCount)} teklif</strong></div>
        </section>

        <section className="report-kpi-grid" aria-label="Açık ve yaşlanan teklif göstergeleri">
          <article className="report-kpi cyan"><span>Takipteki Teklif</span><strong>{formatNumber(result.metrics.trackedCount)}</strong><small>Taslak ve gönderilmiş tüm kayıtlar</small><p>Filtrelenmiş operasyonel nüfus</p></article>
          <article className="report-kpi green"><span>Halen Açık</span><strong>{formatNumber(result.metrics.currentlyOpenCount)}</strong><small>Süresi dolmamış veya tarihi eksik</small><p>Güncel açık teklif tanımı</p></article>
          <article className="report-kpi red"><span>Süresi Dolmuş</span><strong>{formatNumber(result.metrics.overdueCount)}</strong><small>Geçerlilik tarihi geçmiş kayıtlar</small><p>Açık KPI’ına dahil edilmez</p></article>
          <article className="report-kpi amber"><span>Süresi Yaklaşan</span><strong>{formatNumber(result.metrics.nearingExpiryCount)}</strong><small>Önümüzdeki 0–7 gün içinde</small><p>Öncelikli takip grubu</p></article>
          <article className="report-kpi violet"><span>Tarih Eksik</span><strong>{formatNumber(result.metrics.missingValidityCount)}</strong><small>Geçerlilik tarihi bulunmuyor</small><p>Veri kalitesi görünürlüğü</p></article>
          <article className="report-kpi copper"><span>En Yaşlı Teklif</span><strong>{formatNumber(result.metrics.oldestAgeDays)} gün</strong><small>{formatNumber(result.metrics.customerCount)} müşteri · {formatNumber(result.metrics.salespersonCount)} personel</small><p>create_date üzerinden hesaplanır</p></article>
        </section>

        <section className="report-analytics-grid">
          <article className="panel report-section">
            <div className="panel-title"><div><span className="eyebrow">Yaş dağılımı</span><h3>Teklif Yaş Kovaları</h3></div><span className="panel-meta">create_date → referans tarihi</span></div>
            <div className="table-wrap"><table><thead><tr><th>Yaş</th><th>Toplam</th><th>Halen açık</th><th>Süresi dolmuş</th><th>Drill-down</th></tr></thead><tbody>{result.ageDistribution.map((row) => <tr key={row.code}><td><strong>{row.label}</strong></td><td>{formatNumber(row.count)}</td><td className="green-text">{formatNumber(row.currentlyOpenCount)}</td><td className="red-text">{formatNumber(row.overdueCount)}</td><td><a href={createReportHref(result, { ageBucket: row.code })}>Kayıtları aç</a></td></tr>)}</tbody></table></div>
          </article>
          <article className="panel report-section">
            <div className="panel-title"><div><span className="eyebrow">Geçerlilik dağılımı</span><h3>Takip Grupları</h3></div><span className="panel-meta">7 günlük yaklaşan eşik</span></div>
            <div className="table-wrap"><table><thead><tr><th>Grup</th><th>Toplam</th><th>Halen açık</th><th>Drill-down</th></tr></thead><tbody>{result.validityDistribution.map((row) => <tr key={row.code}><td><span className={`report-status ${validityTone(row.code)}`}>{row.label}</span></td><td>{formatNumber(row.count)}</td><td>{formatNumber(row.currentlyOpenCount)}</td><td><a href={createReportHref(result, { validityGroup: row.code })}>Kayıtları aç</a></td></tr>)}</tbody></table></div>
          </article>
        </section>

        <section className="panel report-section report-personnel-section"><div className="panel-title"><div><span className="eyebrow">Sahiplik</span><h3>Personel Takip Özeti</h3></div><span className="panel-meta">{formatNumber(result.salespeople.length)} personel kovası</span></div>{result.salespeople.length > 0 ? <SalespersonTable result={result} /> : <p className="empty-state">Seçili filtrelerde personel verisi bulunamadı.</p>}</section>
        <section className="panel report-section report-customer-section"><div className="panel-title"><div><span className="eyebrow">Sahiplik</span><h3>Müşteri Takip Özeti</h3></div><span className="panel-meta">{formatNumber(result.customers.length)} müşteri</span></div>{result.customers.length > 0 ? <CustomerTable result={result} /> : <p className="empty-state">Seçili filtrelerde müşteri verisi bulunamadı.</p>}</section>

        <section className="panel report-section report-details-section" id="teklif-detayi">
          <div className="panel-title"><div><span className="eyebrow">Drill-down</span><h3>Teklif Takip Detayı</h3></div><span className="panel-meta">{formatNumber(result.detailTotalCount)} kayıt{result.detailsTruncated ? ` · ilk ${formatNumber(result.detailLimit)} gösteriliyor` : ''}</span></div>
          {result.details.length > 0 ? (
            <div className="table-wrap"><table><thead><tr><th>Odoo ID</th><th>Oluşturma</th><th>Yaş</th><th>Personel</th><th>Müşteri</th><th>Kaynak durum</th><th>Geçerlilik</th><th>Takip durumu</th><th>Tutar</th></tr></thead><tbody>{result.details.map((row) => <tr key={row.id}><td>#{row.id}</td><td>{formatDateTime(row.createDate)}</td><td>{formatNumber(row.ageDays)} gün</td><td>{row.salespersonName}</td><td>{row.customerName}</td><td>{row.sourceState === 'sent' ? 'Gönderildi' : 'Taslak'}</td><td>{formatDate(row.validityDate)}</td><td><span className={`report-status ${validityTone(row.validityGroup)}`}>{expiryText(row)}</span></td><td>{formatMoney(row.amountTotal, row.currencyCode)}</td></tr>)}</tbody></table></div>
          ) : <p className="empty-state">Seçili filtrelerde takip edilecek teklif bulunamadı.</p>}
        </section>

        <footer className="report-footer"><span>{result.definition.name} · v{result.definition.version}</span><span>Metrik v{result.definition.metricVersion} · {result.definition.dateAxis}</span><span>Canlı sonuç · {formatDateTime(result.generatedAt)}</span></footer>
      </main>
    </div>
  );
}
