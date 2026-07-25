'use client';

export function ReportPrintButton() {
  return (
    <button className="button" onClick={() => window.print()} type="button">
      Yazdır
    </button>
  );
}
