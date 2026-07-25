# M4 Exports and Production Readiness

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

## Security

- Export endpoints require the same `reports:read` permission as the interactive report.
- Business-unit scope is resolved from the authenticated server-side session.
- Responses use private/no-store caching and attachment disposition.
- Export audit metadata contains filters, counts, versions and request ID only.
- Customer names, quotation amounts, API keys and authorization headers are not copied into audit metadata or logs.

## Runtime

- XLSX generation uses ExcelJS.
- PDF generation uses PDFKit.
- Production Docker installs DejaVu Sans from the Alpine package repository to support Turkish characters.
- Export files are generated in memory and are not retained on application disk.

## Operational acceptance

1. Export one filtered XLSX and open all four worksheets.
2. Export one selected-person PDF after choosing a salesperson.
3. Export one all-person PDF.
4. Compare at least one USD, EUR and TRY detail row with the screen.
5. Confirm export audit events exist.
6. Execute the PostgreSQL backup/restore rehearsal.
7. Execute the application rollback rehearsal with web and worker on the same prior commit.

M4 remains open until the production backup/restore and rollback evidence is recorded.
