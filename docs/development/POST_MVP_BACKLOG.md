# Post-MVP Backlog

## Purpose

This backlog starts after the initial MVP closure on 2026-07-26. It keeps accepted MVP limitations separate from defects that would reopen a closed milestone.

## P0 — Operations follow-up

These are deployment-owner responsibilities, not application feature work:

- keep Coolify PostgreSQL daily backups enabled,
- keep an encrypted off-server backup copy,
- review recent backup-job status periodically,
- repeat the isolated restore workflow after database schema changes,
- update the rollback baseline when a newer release becomes the last verified stable version.

## P1 — M5 additional reports

### Personel Performansı

- period and business-unit filters,
- quotation, realization, open and not-realized metrics,
- customer breadth and trend,
- comparison against previous period and team median,
- detail drill-down and export.

### Müşteri Teklif Geçmişi

- customer timeline,
- assigned salespeople,
- quotation statuses,
- source currencies preserved,
- repeat-quotation and conversion patterns.

### Açık ve Yaşlanan Teklifler

- open quotation age buckets,
- missing validity-date visibility,
- salesperson/customer ownership,
- nearing-expiry and overdue groupings,
- operational follow-up export.

### Tekliften Siparişe Dönüşüm

- quotation cohort based on `create_date`,
- confirmation timing based on `date_order`,
- lag-day distribution,
- salesperson/customer conversion analysis,
- cross-month confirmation handling.

## P2 — Existing report UX

- clearer filter hierarchy and active-filter summary,
- saved filter presets,
- sortable and configurable table columns,
- richer chart tooltips and comparisons,
- direct customer/person drill-down routes,
- more compact responsive layouts,
- loading and empty-state refinements.

## P2 — PDF and print refinement

- Ertip logo and approved corporate header,
- stronger visual hierarchy and cover treatment,
- compact management-summary page,
- charts rendered into PDF,
- improved long-name wrapping instead of truncation where space permits,
- configurable detail-row limits,
- optional portrait person report,
- formal footer/version metadata.

The current fixed-coordinate PDFs remain the accepted MVP baseline until this package is deliberately scheduled.

## P3 — Owner report configuration

Controlled configuration rather than unrestricted BI editing:

- approved dataset selection,
- approved metric and filter selection,
- table/chart layout options,
- publish/unpublish,
- report definition versioning,
- preview and rollback.

## Explicitly deferred

- automatic currency conversion,
- financial totals that mix currencies,
- natural-language report execution,
- scheduled email delivery,
- predictive sales forecasting,
- employee access.

Any currency conversion requires a separately approved exchange-rate source, effective-date policy and audit rule.
