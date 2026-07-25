import type { MonthlyQuotationReportResult } from '@ertip/reporting';

import { ReportPrintButton } from './report-actions';

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
  year: '2-digit',
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${oneDecimalFormatter.format(value * 100)}`;
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

function formatMonth(value: string): string {
  return monthFormatter.format(new Date(`${value}-01T00:00:00.000Z`));
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    realized: 'Gerçekleşen',
    open: 'Açık',
    expired: 'Süresi doldu',
    cancelled: 'İptal',
    unknown: 'Belirsiz',
  };
  return labels[value] ?? value;
}

function statusTone(value: string): string {
  const tones: Record<string, string> = {
    realized: 'green',
    open: 'amber',
    expired: 'red',
    cancelled: 'red',
    unknown: 'muted',
  };
  return tones[value] ?? 'muted';
}

function changeText(change: { readonly absolute: number; readonly percent: number | null }): string {
  const sign = change.absolute > 0 ? '+' : '';
  const percent = change.percent === null ? 'önceki dönem baz yok' : `${sign}${oneDecimalFormatter.format(change.percent * 100)}%`;
  return `${sign}${numberFormatter.format(change.absolute)} · ${percent}`;
}

function MetricCard({
  label,
  value,
  change,
  tone,
  note,
}: Readonly<{
  label: string;
  value: string;
  change: { readonly absolute: number; readonly percent: number | null };
  tone: string;
  note: string;
}>) {
  return (
    <article className={`report-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{changeText(change)}</small>
      <p>{note}</p>
    </article>
  );
}

function createViewHref(result: MonthlyQuotationReportResult, view: string): string {
  const params = new URLSearchParams({
    businessUnitId: result.filters.businessUnitId,
    dateFrom: result.filters.dateFrom,
    dateTo: result.filters.dateTo,
    status: result.filters.status,
    view,
  });

  if (result.filters.salespersonId !== null) {
    params.set('salespersonId', String(result.filters.salespersonId));
  }

  if (result.filters.customerId !== null) {
    params.set('customerId', String(result.filters.customerId));
  }

  return `/reports/monthly-quotation-performance?${params.toString()}`;
}

function ComparisonTable({ result }: Readonly<{ result: MonthlyQuotationReportResult }>) {
  return (
    <div className="table-wrap">
      <table className="report-comparison-table">
        <thead>
          <tr>
            <th>Gösterge</th>
            <th>Seçili dönem</th>
            <th>Önceki dönem</th>
            <th>Değişim</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Toplam teklif</td>
            <td>{formatNumber(result.metrics.quotationCount)}</td>
            <td>{formatNumber(result.previousMetrics.quotationCount)}</td>
            <td>{changeText(result.changes.quotationCount)}</td>
          </tr>
          <tr>
            <td>Gerçekleşen</td>
            <td>{formatNumber(result.metrics.realizedCount)}</td>
            <td>{formatNumber(result.previousMetrics.realizedCount)}</td>
            <td>{changeText(result.changes.realizedCount)}</td>
          </tr>
          <tr>
            <td>Açık</td>
            <td>{formatNumber(result.metrics.openCount)}</td>
            <td>{formatNumber(result.previousMetrics.openCount)}</td>
            <td>{changeText(result.changes.openCount)}</td>
          </tr>
          <tr>
            <td>Gerçekleşmeyen</td>
            <td>{formatNumber(result.metrics.notRealizedCount)}</td>
            <td>{formatNumber(result.previousMetrics.notRealizedCount)}</td>
            <td>{changeText(result.changes.notRealizedCount)}</td>
          </tr>
          <tr>
            <td>Dönüşüm oranı</td>
            <td>{formatPercent(result.metrics.conversionRate)}</td>
            <td>{formatPercent(result.previousMetrics.conversionRate)}</td>
            <td>{changeText(result.changes.conversionRate)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SalespersonTable({ result }: Readonly<{ result: MonthlyQuotationReportResult }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Personel</th>
            <th>Teklif</th>
            <th>Gerçekleşen</th>
            <th>Açık</th>
            <th>Gerçekleşmeyen</th>
            <th>Dönüşüm</th>
            <th>Son teklif</th>
          </tr>
        </thead>
        <tbody>
          {result.salespeople.map((row) => (
            <tr key={row.salespersonId ?? 'unassigned'}>
              <td>
                <strong>{row.displayName}</strong>
                <small className="table-subtitle">
                  {row.salespersonId === null ? 'Kaynakta personel atanmamış' : `Odoo kullanıcı #${row.salespersonId}`}
                </small>
              </td>
              <td>{formatNumber(row.metrics.quotationCount)}</td>
              <td className="green-text">{formatNumber(row.metrics.realizedCount)}</td>
              <td className="amber-text">{formatNumber(row.metrics.openCount)}</td>
              <td className="red-text">{formatNumber(row.metrics.notRealizedCount)}</td>
              <td>{formatPercent(row.metrics.conversionRate)}</td>
              <td>{formatDate(row.lastQuotationDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerTable({ result }: Readonly<{ result: MonthlyQuotationReportResult }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Müşteri</th>
            <th>Teklif</th>
            <th>Gerçekleşen</th>
            <th>Açık</th>
            <th>Gerçekleşmeyen</th>
            <th>Dönüşüm</th>
            <th>Son teklif</th>
          </tr>
        </thead>
        <tbody>
          {result.customers.map((row) => (
            <tr key={row.customerId}>
              <td>
                <strong>{row.displayName}</strong>
                <small className="table-subtitle">Odoo müşteri #{row.customerId}</small>
              </td>
              <td>{formatNumber(row.metrics.quotationCount)}</td>
              <td className="green-text">{formatNumber(row.metrics.realizedCount)}</td>
              <td className="amber-text">{formatNumber(row.metrics.openCount)}</td>
              <td className="red-text">{formatNumber(row.metrics.notRealizedCount)}</td>
              <td>{formatPercent(row.metrics.conversionRate)}</td>
              <td>{formatDate(row.lastQuotationDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonthlyQuotationReportView({
  result,
  user,
  demoMode,
}: Readonly<{
  result: MonthlyQuotationReportResult;
  user: ReportUser;
  demoMode: boolean;
}>) {
  const trendMaximum = Math.max(1, ...result.trend.map(({ quotationCount }) => quotationCount));
  const realizedShare = result.metrics.quotationCount === 0 ? 0 : result.metrics.realizedCount / result.metrics.quotationCount;
  const openShare = result.metrics.quotationCount === 0 ? 0 : result.metrics.openCount / result.metrics.quotationCount;
  const notRealizedShare = result.metrics.quotationCount === 0 ? 0 : result.metrics.notRealizedCount / result.metrics.quotationCount;
  const realizedDegrees = realizedShare * 360;
  const openDegrees = openShare * 360;
  const notRealizedDegrees = notRealizedShare * 360;

  return (
    <div className="app-shell report-app-shell">
      <aside className="sidebar report-sidebar">
        <a className="brand" href="/">
          <b>ER</b>
          <div>
            <strong>Ertip Report</strong>
            <span>Executive Intelligence</span>
          </div>
        </a>
        <nav aria-label="Rapor navigasyonu">
          <small>Çalışma Alanı</small>
          <a className="nav-item" href="/"><i>1</i>Genel Bakış</a>
          <a className="nav-item active" href="/reports/monthly-quotation-performance"><i>2</i>Raporlar</a>
          <small className="nav-heading">Aktif rapor</small>
          <span className="sidebar-report-name">Aylık Teklif Performansı</span>
        </nav>
        <div className="sidebar-footer">
          <span className="status online" />
          <div>
            <strong>{result.businessUnit.displayName}</strong>
            <small>Son senkron: {formatDateTime(result.lastSyncAt)}</small>
          </div>
        </div>
      </aside>

      <main className="report-main">
        <header className="topbar report-topbar no-print">
          <div>
            <span className="eyebrow">Satış ve Teklifler</span>
            <h1>Yönetim Raporu</h1>
          </div>
          <div className="user-menu">
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span>
            </div>
            <a className="button" href="/">Panele dön</a>
          </div>
        </header>

        <section className="report-heading">
          <div>
            <div className="badges">
              <span>{result.businessUnit.displayName}</span>
              <span>{result.businessUnit.currencyCode}</span>
              <span>{demoMode ? 'Demo veri' : 'Canlı veri'}</span>
              <span>v{result.definition.version}</span>
            </div>
            <h2>Aylık Teklif Performansı</h2>
            <p>
              Teklif üretimini, güncel sonuç durumunu, personel performansını ve müşteri yoğunluğunu
              <code> create_date</code> kohortuyla tek görünümde izler.
            </p>
          </div>
          <div className="report-heading-actions no-print">
            <ReportPrintButton />
            <a className="button primary" href="#teklif-detayi">Teklif Detayı</a>
          </div>
        </section>

        <section className="report-metadata print-only">
          <strong>{result.definition.name}</strong>
          <span>Oluşturulma: {formatDateTime(result.generatedAt)}</span>
          <span>Son senkronizasyon: {formatDateTime(result.lastSyncAt)}</span>
          <span>Tarih ekseni: {result.definition.dateAxis}</span>
        </section>

        <form className="report-filters no-print" method="get">
          <label>
            <span>Başlangıç</span>
            <input defaultValue={result.filters.dateFrom} name="dateFrom" required type="date" />
          </label>
          <label>
            <span>Bitiş (hariç)</span>
            <input defaultValue={result.filters.dateTo} name="dateTo" required type="date" />
          </label>
          <label>
            <span>İş birimi</span>
            <select defaultValue={result.filters.businessUnitId} name="businessUnitId">
              {result.options.businessUnits.map((option) => (
                <option key={option.id} value={option.id}>{option.displayName}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Personel</span>
            <select defaultValue={result.filters.salespersonId ?? ''} name="salespersonId">
              <option value="">Tüm personel</option>
              {result.options.salespeople.map((option) => (
                <option key={option.id} value={option.id}>{option.displayName}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Müşteri</span>
            <select defaultValue={result.filters.customerId ?? ''} name="customerId">
              <option value="">Tüm müşteriler</option>
              {result.options.customers.map((option) => (
                <option key={option.id} value={option.id}>{option.displayName}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Durum</span>
            <select defaultValue={result.filters.status} name="status">
              <option value="all">Tüm durumlar</option>
              <option value="realized">Gerçekleşen</option>
              <option value="open">Açık</option>
              <option value="not_realized">Gerçekleşmeyen</option>
              <option value="expired">Süresi doldu</option>
              <option value="cancelled">İptal</option>
            </select>
          </label>
          <input name="view" type="hidden" value={result.filters.view} />
          <button className="button primary" type="submit">Raporu Çalıştır</button>
          <a className="button" href="/reports/monthly-quotation-performance">Temizle</a>
        </form>

        <nav className="report-tabs no-print" aria-label="Rapor görünümü">
          {[
            ['general', 'Genel'],
            ['salesperson', 'Personel'],
            ['customer', 'Müşteri'],
          ].map(([view, label]) => (
            <a
              aria-current={result.filters.view === view ? 'page' : undefined}
              className={result.filters.view === view ? 'active' : ''}
              href={createViewHref(result, view ?? 'general')}
              key={view}
            >
              {label}
            </a>
          ))}
        </nav>

        <section className="report-period-summary">
          <div>
            <span className="eyebrow">Seçili dönem</span>
            <strong>{formatDate(result.filters.dateFrom)} – {formatDate(result.filters.dateTo)}</strong>
          </div>
          <div>
            <span className="eyebrow">Karşılaştırma dönemi</span>
            <strong>{formatDate(result.previousPeriod.dateFrom)} – {formatDate(result.previousPeriod.dateTo)}</strong>
          </div>
          <div>
            <span className="eyebrow">Son veri senkronizasyonu</span>
            <strong>{formatDateTime(result.lastSyncAt)}</strong>
          </div>
          <div>
            <span className="eyebrow">Rapor zamanı</span>
            <strong>{formatDateTime(result.generatedAt)}</strong>
          </div>
        </section>

        <section className="report-kpi-grid" aria-label="Teklif performans göstergeleri">
          <MetricCard
            change={result.changes.quotationCount}
            label="Toplam Teklif"
            note="Seçili dönemde oluşturulan benzersiz teklifler"
            tone="cyan"
            value={formatNumber(result.metrics.quotationCount)}
          />
          <MetricCard
            change={result.changes.realizedCount}
            label="Gerçekleşen"
            note="Güncel durumu Sales Order olan teklifler"
            tone="green"
            value={formatNumber(result.metrics.realizedCount)}
          />
          <MetricCard
            change={result.changes.openCount}
            label="Açık"
            note="Henüz sonuçlanmamış ve süresi dolmamış teklifler"
            tone="amber"
            value={formatNumber(result.metrics.openCount)}
          />
          <MetricCard
            change={result.changes.notRealizedCount}
            label="Gerçekleşmeyen"
            note="İptal ve süresi dolmuş tekliflerin toplamı"
            tone="red"
            value={formatNumber(result.metrics.notRealizedCount)}
          />
          <MetricCard
            change={result.changes.conversionRate}
            label="Dönüşüm Oranı"
            note="Gerçekleşen teklif / toplam teklif"
            tone="violet"
            value={formatPercent(result.metrics.conversionRate)}
          />
          <MetricCard
            change={result.changes.quotedCustomerCount}
            label="Teklif Verilen Müşteri"
            note="Dönem içindeki benzersiz müşteri sayısı"
            tone="copper"
            value={formatNumber(result.metrics.quotedCustomerCount)}
          />
        </section>

        {result.openWithoutValidityCount > 0 ? (
          <aside className="report-data-note">
            <strong>{formatNumber(result.openWithoutValidityCount)} açık teklifin geçerlilik tarihi boş.</strong>
            <span>Bu kayıtlar metrik v1.0 kuralıyla açık kabul edilir; gerçekleşmeyen sayısına eklenmez.</span>
          </aside>
        ) : null}

        <section className="report-analytics-grid">
          <article className="panel report-trend-panel">
            <div className="panel-title">
              <div><span className="eyebrow">6 aylık eğilim</span><h3>Teklif Üretimi</h3></div>
              <span className="panel-meta">create_date kohortu</span>
            </div>
            <div className="report-bars" role="img" aria-label="Altı aylık teklif üretim eğilimi">
              {result.trend.map((point) => (
                <div className="report-bar" key={point.month}>
                  <b>{formatNumber(point.quotationCount)}</b>
                  <div><i style={{ height: `${Math.max(4, (point.quotationCount / trendMaximum) * 100)}%` }} /></div>
                  <span>{formatMonth(point.month)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel report-distribution-panel">
            <div className="panel-title">
              <div><span className="eyebrow">Güncel sonuç</span><h3>Durum Dağılımı</h3></div>
            </div>
            <div className="report-donut-row">
              <div
                className="report-donut"
                style={{
                  background: `conic-gradient(var(--green) 0deg ${realizedDegrees}deg, var(--amber) ${realizedDegrees}deg ${realizedDegrees + openDegrees}deg, var(--red) ${realizedDegrees + openDegrees}deg ${realizedDegrees + openDegrees + notRealizedDegrees}deg, #526577 ${realizedDegrees + openDegrees + notRealizedDegrees}deg 360deg)`,
                }}
              >
                <div><strong>{formatPercent(result.metrics.conversionRate)}</strong><span>Dönüşüm</span></div>
              </div>
              <ul>
                <li><i className="green" /><span>Gerçekleşen</span><b>{formatNumber(result.metrics.realizedCount)}</b></li>
                <li><i className="amber" /><span>Açık</span><b>{formatNumber(result.metrics.openCount)}</b></li>
                <li><i className="red" /><span>Süresi doldu</span><b>{formatNumber(result.metrics.expiredCount)}</b></li>
                <li><i className="red" /><span>İptal</span><b>{formatNumber(result.metrics.cancelledCount)}</b></li>
              </ul>
            </div>
          </article>
        </section>

        {result.filters.view === 'general' ? (
          <section className="panel report-section">
            <div className="panel-title"><div><span className="eyebrow">Dönem karşılaştırması</span><h3>Seçili Dönem / Önceki Dönem</h3></div></div>
            <ComparisonTable result={result} />
          </section>
        ) : null}

        {result.filters.view === 'general' || result.filters.view === 'salesperson' ? (
          <section className="panel report-section report-personnel-section">
            <div className="panel-title">
              <div><span className="eyebrow">Ekip görünümü</span><h3>Personel Karşılaştırması</h3></div>
              <span className="panel-meta">{formatNumber(result.salespeople.length)} personel kovası</span>
            </div>
            {result.salespeople.length > 0 ? <SalespersonTable result={result} /> : <p className="empty-state">Seçili filtrelerde personel verisi bulunamadı.</p>}
          </section>
        ) : null}

        {result.filters.view === 'general' || result.filters.view === 'customer' ? (
          <section className="panel report-section report-customer-section">
            <div className="panel-title">
              <div><span className="eyebrow">Müşteri görünümü</span><h3>Müşteri Teklif Özeti</h3></div>
              <span className="panel-meta">{formatNumber(result.customers.length)} müşteri</span>
            </div>
            {result.customers.length > 0 ? <CustomerTable result={result} /> : <p className="empty-state">Seçili filtrelerde müşteri verisi bulunamadı.</p>}
          </section>
        ) : null}

        <section className="panel report-section report-details-section" id="teklif-detayi">
          <div className="panel-title">
            <div><span className="eyebrow">Drill-down</span><h3>Teklif Detayı</h3></div>
            <span className="panel-meta">
              {formatNumber(result.detailTotalCount)} kayıt{result.detailsTruncated ? ` · ilk ${formatNumber(result.detailLimit)} gösteriliyor` : ''}
            </span>
          </div>
          {result.details.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Odoo ID</th>
                    <th>Oluşturma</th>
                    <th>Personel</th>
                    <th>Müşteri</th>
                    <th>Durum</th>
                    <th>Geçerlilik</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((row) => (
                    <tr key={row.id}>
                      <td>#{row.id}</td>
                      <td>{formatDateTime(row.createDate)}</td>
                      <td>{row.salespersonName}</td>
                      <td>{row.customerName}</td>
                      <td><span className={`report-status ${statusTone(row.normalizedStatus)}`}>{statusLabel(row.normalizedStatus)}</span></td>
                      <td>{formatDate(row.validityDate)}</td>
                      <td>{formatMoney(row.amountTotal, row.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">Seçili filtrelerde teklif bulunamadı.</p>
          )}
        </section>

        <footer className="report-footer">
          <span>{result.definition.name} · v{result.definition.version}</span>
          <span>Metrik v{result.definition.metricVersion} · {result.definition.dateAxis}</span>
          <span>Canlı sonuç · {formatDateTime(result.generatedAt)}</span>
        </footer>
      </main>
    </div>
  );
}
