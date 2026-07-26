# M5 Implementation Plan — Additional Reports

## Status

**Planned.** Starts after the initial MVP closure at commit `2d3d0da3594228033febb0ab90cc29329452210b`.

## Goal

Expand the accepted reporting foundation with four distinct management reports while preserving the existing canonical metric, scope, export and security contracts.

## Delivery order

### M5.1 — Open and Aging Quotations

This is the first post-MVP slice because it adds the highest operational value without duplicating the personnel comparison already present in the monthly report.

Required capabilities:

- business-unit, salesperson, customer and age/status filters,
- only `draft` / `sent` quotations in the open population,
- age based on `sale.order.create_date`,
- expiry state based on `validity_date`,
- explicit missing-validity-date bucket,
- age buckets: `0–7`, `8–14`, `15–30`, `31–60`, `61–90`, `90+` days,
- expiry groups: valid, nearing expiry, overdue, validity date missing,
- owner/salesperson/customer summary,
- quotation detail drill-down,
- source currency preserved per order,
- XLSX operational follow-up export,
- printable/PDF management output after the interactive report is accepted,
- export audit events and server-side scope enforcement.

Canonical rules:

- open means `state in (draft, sent)` and not expired,
- expired draft/sent rows remain visible as overdue/expired operational records but are not counted as currently open,
- `validity_date = null` is never silently treated as expired,
- no currency conversion and no mixed-currency total.

Exit criteria:

- selected filters produce the same population in screen, JSON API and XLSX,
- age and expiry buckets are covered by unit and PostgreSQL fixture tests,
- Manager cannot access a business unit outside the server-side session scope,
- production user accepts the report as operationally useful.

### M5.2 — Customer Quotation History

Required capabilities:

- customer search and direct customer route,
- chronological quotation timeline,
- assigned salesperson history,
- status distribution,
- repeat quotation frequency,
- first/last quotation dates,
- realized/open/not-realized patterns,
- source currencies preserved,
- detail export.

Exit criteria:

- customer totals reconcile with the canonical monthly report for the same filters,
- timeline order and status changes are deterministic,
- customer route respects business-unit scope.

### M5.3 — Personnel Performance

Required capabilities:

- dedicated salesperson report route,
- current and previous period comparison,
- team median comparison,
- quotation, realized, open and not-realized metrics,
- customer breadth,
- trend and customer concentration,
- direct drill-down and export.

This report must reuse the existing metric engine rather than duplicate the monthly report calculations.

### M5.4 — Quotation-to-Order Conversion

Required capabilities:

- quotation cohort based on `sale.order.create_date`,
- confirmation timing based on `sale.order.date_order` only for `state = sale`,
- lag-day distribution,
- same-month and cross-month confirmation analysis,
- salesperson and customer conversion breakdown,
- previous-period comparison,
- explicit treatment of records where `date_order < create_date` or other source anomalies are discovered.

This slice is last because it introduces a second time axis and requires the most careful validation.

## Shared architecture rules

- Interactive report queries use local PostgreSQL only; no browser or report request calls Odoo.
- Screen, JSON API, XLSX and PDF consume one report-result contract per report.
- Existing `reports:read` authorization and `allowedBusinessUnitIds` server-side enforcement remain mandatory.
- Every export records a safe audit event without customer names, order names, amounts, API keys or authorization data in metadata.
- Mixed currencies are never aggregated into one financial total without a separately approved exchange-rate policy.
- Report metadata includes report version, generated time, filters, business-unit scope, date axis and last successful sync context.

## Test gates

Each slice must include:

- pure metric/unit tests,
- PostgreSQL fixture integration tests,
- scope/authorization tests,
- strict TypeScript, lint and format checks,
- production Docker build,
- Chromium navigation and API checks,
- export artifact validation when exports are part of the slice.

## Deferred from M5

- automatic currency conversion,
- unrestricted report builder,
- scheduled email delivery,
- predictive forecasting,
- employee access,
- large visual redesign of the accepted MVP report and PDF system.
