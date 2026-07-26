# M4 Exports and Production Readiness

## Status

**Closed on 2026-07-26.** See `M4_EXIT_REPORT.md` and `M4_PRODUCTION_ACCEPTANCE.md`.

## Goal

Make the first live report usable in management meetings without technical assistance and establish a controlled production backup/rollback procedure.

## Export contract

All outputs consume the canonical M3 report result and order-level currency information.

### XLSX

The filtered report downloads as one workbook with four sheets:

1. `Özet`
2. `Personel`
3. `Müşteriler`
4. `Teklif Detayı`

Amounts and currency codes remain in separate columns. USD, EUR and TRY values are never added together without an approved conversion rule.

### Selected-person PDF

Requires an explicit salesperson filter. It contains:

- report metadata,
- KPI summary,
- selected salesperson metrics,
- top customers,
- complete filtered quotation detail.

### All-person PDF

Clears salesperson and customer dimensions while preserving date, business-unit and status scope. It contains:

- overall KPI summary,
- team comparison,
- one section per salesperson,
- top customers per salesperson,
- latest 25 detail rows per salesperson.

The complete detail population remains available in XLSX; the PDF states when its per-person detail list is abbreviated.

The original PDF implementation was rejected during production review. The accepted MVP renderer uses fixed A4 landscape coordinates, deterministic page breaks, repeated table headers and pinned DejaVu Sans fonts.

## Security

- Export endpoints require the explicit `reports:export` permission.
- Business-unit scope is resolved from the authenticated server-side session.
- Responses use private/no-store caching and attachment disposition.
- Export audit metadata contains filters, counts, versions and request ID only.
- Customer names, quotation amounts, API keys and authorization headers are not copied into audit metadata or logs.

## Runtime

- XLSX generation uses ExcelJS.
- PDF generation uses PDFKit.
- Production Docker contains pinned regular and bold DejaVu Sans files for Turkish glyphs.
- Export files are generated in memory and are not retained on application disk.

## Operational acceptance

Completed checks:

1. filtered XLSX opened and accepted in production,
2. selected-person PDF accepted for MVP,
3. all-person PDF accepted for MVP,
4. source USD/EUR/TRY preserved,
5. export audit persistence covered,
6. isolated PostgreSQL custom backup restored into a fresh database with identical signature,
7. previous verified web/worker commit started against the current schema,
8. previous web readiness, Owner session, report API and worker leadership lease passed,
9. production was not deliberately interrupted for the rehearsal.

The repeatable implementation lives in `.github/workflows/m4-operations-rehearsal.yml`.

## Remaining operations responsibility

GitHub CI cannot inspect the external Coolify scheduler. Production must continue to keep daily PostgreSQL backup and an encrypted off-server copy enabled. This is a deployment operations responsibility rather than an open M4 application-development task.
