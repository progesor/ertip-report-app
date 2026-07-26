import type { ReactNode } from 'react';

import type {
  CurrencyAmountMetrics,
  SourceCurrencyPeriodComparison,
} from '@ertip/reporting';

const percentFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatMoney(value: string, currencyCode: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || currencyCode === 'XXX') {
    return `${value} ${currencyCode}`;
  }

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${value} ${currencyCode}`;
  }
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${percentFormatter.format(value * 100)}`;
}

function formatChange(
  value: { readonly absolute: string; readonly percent: number | null },
  currencyCode: string,
): string {
  const percent =
    value.percent === null
      ? 'baz yok'
      : `${value.percent > 0 ? '+' : ''}${percentFormatter.format(value.percent * 100)}%`;
  return `${formatMoney(value.absolute, currencyCode)} · ${percent}`;
}

export function SourceCurrencyAmountDrawer({
  children,
  label = 'Tutar Analizi',
}: Readonly<{ children: ReactNode; label?: string }>) {
  return (
    <details
      className="no-print"
      data-testid="source-currency-drawer"
      style={{
        bottom: 24,
        position: 'fixed',
        right: 24,
        zIndex: 60,
      }}
    >
      <summary
        className="button primary"
        style={{ cursor: 'pointer', listStyle: 'none', marginLeft: 'auto', width: 'fit-content' }}
      >
        {label}
      </summary>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.48)',
          marginTop: 10,
          maxHeight: '78vh',
          maxWidth: 'calc(100vw - 32px)',
          overflow: 'auto',
          padding: 12,
          width: 'min(1040px, calc(100vw - 48px))',
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function SourceCurrencyAmountComparisonTable({
  rows,
  title = 'Kaynak Para Birimi Tutar Analizi',
  eyebrow = 'Tutar karşılaştırması',
}: Readonly<{
  rows: readonly SourceCurrencyPeriodComparison[];
  title?: string;
  eyebrow?: string;
}>) {
  return (
    <section className="panel table-panel" data-testid="source-currency-comparison">
      <div className="panel-title">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <small>Para birimleri dönüştürülmez ve birbirine eklenmez.</small>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Para birimi</th>
              <th>Teklif tutarı</th>
              <th>Önceki teklif</th>
              <th>Teklif değişimi</th>
              <th>Gerçekleşen satış</th>
              <th>Önceki satış</th>
              <th>Açık tutar</th>
              <th>Gerçekleşmeyen</th>
              <th>Tutar dönüşümü</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.currencyCode}>
                <td><strong>{row.currencyCode}</strong></td>
                <td>{formatMoney(row.current.quotationAmount, row.currencyCode)}</td>
                <td>{formatMoney(row.previous.quotationAmount, row.currencyCode)}</td>
                <td>{formatChange(row.changes.quotationAmount, row.currencyCode)}</td>
                <td className="green-text">{formatMoney(row.current.realizedAmount, row.currencyCode)}</td>
                <td>{formatMoney(row.previous.realizedAmount, row.currencyCode)}</td>
                <td className="amber-text">{formatMoney(row.current.openAmount, row.currencyCode)}</td>
                <td className="red-text">{formatMoney(row.current.notRealizedAmount, row.currencyCode)}</td>
                <td>{formatPercent(row.current.amountConversionRate)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={9}>Seçili filtrelerde tutar kaydı bulunamadı.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SourceCurrencyAmountTable({
  rows,
  title,
  eyebrow = 'Kaynak para birimi',
  description = 'Para birimleri dönüştürülmez ve birbirine eklenmez.',
}: Readonly<{
  rows: readonly CurrencyAmountMetrics[];
  title: string;
  eyebrow?: string;
  description?: string;
}>) {
  return (
    <section className="panel table-panel" data-testid="source-currency-amounts">
      <div className="panel-title">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <small>{description}</small>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Para birimi</th>
              <th>Toplam teklif</th>
              <th>Gerçekleşen satış</th>
              <th>Açık tutar</th>
              <th>Gerçekleşmeyen</th>
              <th>Süresi dolmuş</th>
              <th>İptal</th>
              <th>Tutar dönüşümü</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.currencyCode}>
                <td><strong>{row.currencyCode}</strong></td>
                <td>{formatMoney(row.quotationAmount, row.currencyCode)}</td>
                <td className="green-text">{formatMoney(row.realizedAmount, row.currencyCode)}</td>
                <td className="amber-text">{formatMoney(row.openAmount, row.currencyCode)}</td>
                <td className="red-text">{formatMoney(row.notRealizedAmount, row.currencyCode)}</td>
                <td>{formatMoney(row.expiredAmount, row.currencyCode)}</td>
                <td>{formatMoney(row.cancelledAmount, row.currencyCode)}</td>
                <td>{formatPercent(row.amountConversionRate)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={8}>Seçili filtrelerde tutar kaydı bulunamadı.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
