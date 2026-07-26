'use client';

import { useSyncExternalStore } from 'react';

function startExport(format: 'xlsx' | 'pdf', scope?: 'all' | 'salesperson'): void {
  const url = new URL('/api/reports/monthly-quotation-performance/export', window.location.origin);
  const current = new URLSearchParams(window.location.search);

  for (const [key, value] of current.entries()) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('format', format);

  if (scope) {
    url.searchParams.set('scope', scope);
  }

  if (scope === 'all') {
    url.searchParams.delete('salespersonId');
    url.searchParams.delete('customerId');
  }

  window.location.assign(url.toString());
}

function subscribeToLocation(): () => void {
  return () => undefined;
}

function getSalespersonSnapshot(): boolean {
  return Boolean(new URLSearchParams(window.location.search).get('salespersonId'));
}

export function ReportPrintButton() {
  const hasSalesperson = useSyncExternalStore(
    subscribeToLocation,
    getSalespersonSnapshot,
    () => false,
  );

  return (
    <div className="report-export-actions">
      <button className="button" onClick={() => window.print()} type="button">
        Yazdır
      </button>
      <button className="button" onClick={() => startExport('xlsx')} type="button">
        Excel İndir
      </button>
      <button className="button" onClick={() => startExport('pdf', 'all')} type="button">
        Tüm Personel PDF
      </button>
      <button
        className="button"
        disabled={!hasSalesperson}
        onClick={() => startExport('pdf', 'salesperson')}
        title={hasSalesperson ? 'Seçili personelin PDF raporunu indir' : 'Önce personel filtresi seçin'}
        type="button"
      >
        Seçili Personel PDF
      </button>
    </div>
  );
}
