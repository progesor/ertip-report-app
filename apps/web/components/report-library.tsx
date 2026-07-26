import Link from 'next/link';

import {
  REPORT_CATALOG,
  REPORT_CATEGORIES,
  reportsByCategory,
  type ReportCatalogItem,
} from '@/lib/report-catalog';

function ReportCard({ report }: Readonly<{ report: ReportCatalogItem }>) {
  return (
    <article className={`report-library-card ${report.accent}`}>
      <div className="report-library-card-head">
        <span>{report.category}</span>
        <small>{report.dateAxis}</small>
      </div>
      <div>
        <h3>{report.title}</h3>
        <p>{report.description}</p>
      </div>
      <ul aria-label={`${report.title} özellikleri`}>
        {report.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
      </ul>
      <Link className="report-library-action" href={report.href}>
        Raporu Aç <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export function ReportLibrary() {
  return (
    <>
      <section className="report-library-hero">
        <div>
          <span className="workspace-kicker">Rapor kütüphanesi</span>
          <h2>Karar vermek için gereken görünümü seçin.</h2>
          <p>
            Beş kabul edilmiş yönetim raporu aynı PostgreSQL veri kaynağı, yetki kapsamı ve
            kaynak para birimi kurallarıyla çalışır.
          </p>
        </div>
        <div className="report-library-summary" aria-label="Rapor kütüphanesi özeti">
          <strong>{REPORT_CATALOG.length}</strong>
          <span>canlı rapor</span>
          <small>Owner ve Manager erişimi</small>
        </div>
      </section>

      <section className="report-category-nav" aria-label="Rapor kategorileri">
        {REPORT_CATEGORIES.map((category) => (
          <a href={`#${category.toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}`} key={category}>
            {category}
            <span>{reportsByCategory(category).length}</span>
          </a>
        ))}
      </section>

      <div className="report-library-sections">
        {REPORT_CATEGORIES.map((category) => {
          const reports = reportsByCategory(category);
          return (
            <section
              className="report-library-section"
              id={category.toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}
              key={category}
            >
              <div className="report-library-section-title">
                <div>
                  <span className="workspace-kicker">Kategori</span>
                  <h2>{category}</h2>
                </div>
                <small>{reports.length} rapor</small>
              </div>
              <div className="report-library-grid">
                {reports.map((report) => <ReportCard key={report.code} report={report} />)}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
