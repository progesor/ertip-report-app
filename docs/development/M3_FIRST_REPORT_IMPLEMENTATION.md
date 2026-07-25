# M3 First Report Implementation

## Scope

M3 delivers the first production report: **Yurt Dışı Aylık Teklif Performansı**.

The report reads only the local PostgreSQL synchronization tables. It never calls Odoo during an interactive report request and never writes to Odoo.

## Canonical definition

| Property | Value |
| --- | --- |
| Report code | `international-monthly-quotation-performance` |
| Report version | `1.0.0` |
| Metric version | `1.0.0` |
| Date axis | `sale.order.create_date` |
| Default business unit | Yurt Dışı / UUID `11111111-1111-4111-8111-111111111111` |
| Default source currency | USD |
| Result mode | Live local result |

The selected date range uses an inclusive start and exclusive end. A full July report therefore uses:

```text
dateFrom=2026-07-01
dateTo=2026-08-01
```

## Status normalization

- `sale` -> Gerçekleşen
- `cancel` -> İptal
- `draft` / `sent` with a past `validity_date` -> Süresi doldu
- other `draft` / `sent` -> Açık
- unsupported value -> Belirsiz
- Gerçekleşmeyen -> İptal + Süresi doldu

`validity_date` is absent on part of the live tenant. Metric version 1.0 keeps those `draft` / `sent` records in **Açık** and surfaces their count as a visible data-quality note. They are never silently moved into Gerçekleşmeyen.

## Central result contract

The reporting package owns a single `MonthlyQuotationReportResult` contract used by:

- the report screen,
- the JSON report API,
- the print view,
- future PDF/XLSX adapters.

The contract contains:

- report and metric metadata,
- selected filters,
- current and previous-period metrics,
- KPI changes,
- six-month trend,
- salesperson aggregation,
- customer aggregation,
- detail rows,
- filter options,
- last successful synchronized timestamp.

## Filters

- inclusive start date,
- exclusive end date,
- allowed business unit,
- salesperson,
- customer,
- normalized status,
- general / salesperson / customer view.

The maximum interactive date range is 366 days. The database query is always constrained to one business unit, preventing accidental cross-currency totals.

## Authorization

Both Owner and Manager require `reports:read`.

The requested business-unit UUID must be present in the authenticated user's server-side `allowedBusinessUnitIds`. A URL parameter cannot expand the permitted scope.

Owner sessions currently receive all active business units. Manager sessions receive only explicit `user_business_unit_scopes` rows.

## User interface

Route:

```text
/reports/monthly-quotation-performance
```

API:

```text
GET /api/reports/monthly-quotation-performance
```

The screen includes:

- report metadata and last synchronization time,
- URL-backed filters,
- general / salesperson / customer tabs,
- six KPI cards,
- six-month quotation trend,
- normalized status distribution,
- previous-period comparison,
- salesperson table,
- customer table,
- sale-order drill-down table,
- explicit currency display,
- responsive desktop/tablet/mobile behavior,
- A4 landscape print layout.

Production dashboard no longer displays hard-coded performance values. Demo fixtures remain isolated behind `APP_DEMO_MODE=true`.

## Detail limit

The interactive detail table returns up to 500 rows by default and exposes the complete filtered row count. The central service supports a bounded limit up to 1,000. Future XLSX export will consume the same result definition with an export-specific paging adapter.

## Verification

Unit coverage verifies:

- Istanbul current-month defaults,
- status normalization,
- current and previous-period KPI calculations,
- salesperson/customer grouping,
- trend buckets,
- status and salesperson filters,
- missing-validity visibility.

PostgreSQL integration coverage inserts a deterministic Yurt Dışı fixture and verifies:

- business-unit/currency scope,
- current and previous metrics,
- unassigned salesperson grouping,
- customer aggregation,
- detail rows,
- last successful sync timestamp,
- denied business-unit scope.

Browser smoke coverage verifies:

- dashboard-to-report navigation,
- filters and KPI rendering,
- charts and drill-down,
- view switching,
- canonical JSON API response.

## Production acceptance

1. Deploy web from the merged M3 commit.
2. Open the report after a successful full synchronization.
3. Select a manually verified month.
4. Compare total, realized, open, expired/cancelled and salesperson counts against a controlled Odoo export.
5. Confirm Manager scope cannot access an unauthorized business unit.
6. Print the report and verify KPI, chart and all person/customer/detail sections remain readable.
