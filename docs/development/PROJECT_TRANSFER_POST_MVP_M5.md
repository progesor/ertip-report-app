# Ertip Report App — Controlled Transfer to Post-MVP M5

## Canonical repository state

- Repository: `progesor/ertip-report-app`
- Canonical branch: `main`
- Synced branch: `develop`
- MVP closure commit: `2d3d0da3594228033febb0ab90cc29329452210b`
- MVP closure PR: `#19`
- Production URL: `https://report.progesor.net/`
- Deployment: Coolify auto-deploy from `main`

Before writing code in a new conversation, verify that GitHub `main` still contains the expected commit or a clearly understood later commit. Do not rely on remembered file contents when the repository differs.

## Product boundary

Ertip Report App is a private management-reporting application for one Odoo Online Custom database containing two companies:

- Yurt Dışı: Odoo company ID `1`, business-unit ID `11111111-1111-4111-8111-111111111111`, base currency USD.
- Yurt İçi: Odoo company ID `25`, business-unit ID `22222222-2222-4222-8222-222222222222`, base currency TRY.

Only Owner and Manager roles exist. Employees do not receive application access. Odoo access is read-only JSON-2. Reports read from local PostgreSQL and never query Odoo directly from the browser.

## Closed milestones

### M0 — Discovery and Canon

- Odoo `19.0+e` verified.
- `sale.order.create_date` is the quotation cohort axis.
- `sale.order.date_order` is reserved for confirmation timing on realized orders.
- Company mappings and source states verified.

### M1 — Foundation and Live Deployment

- Next.js modular monolith plus separate worker.
- PostgreSQL-backed authentication, Owner/Manager authorization and business-unit scope.
- Docker/Coolify web and worker deployments.
- CI, health endpoints and design-system shell.

### M2 — Durable Odoo Synchronization

- Read-only JSON-2 adapter.
- Durable PostgreSQL sync queue and source-ID cursor paging.
- Customer, salesperson, currency and order synchronization.
- Placeholder preservation for missing/inaccessible references.
- Worker leadership lease.
- Two consecutive production full syncs reconciled `6,875 / 6,875` with no duplicate growth or stale deletion.

### M3 — First Live Report

- Yurt Dışı Aylık Teklif Performansı.
- General/person/customer views.
- Date, business unit, salesperson, customer and status filters.
- KPI, trends, breakdowns, drill-down and previous-period comparison.
- Per-order USD/EUR/TRY display without implicit conversion.
- JSON API and print view.

### M4 — Exports and Production Readiness

- Filtered XLSX with four worksheets.
- Selected-person and all-person PDF.
- Export audit log and Owner audit view.
- Fixed-coordinate PDF renderer accepted for MVP.
- Isolated PostgreSQL backup/restore rehearsal passed.
- Previous verified web and worker release passed compatibility checks against the current schema.
- Initial MVP closed on 2026-07-26.

## Current production behavior

- The production worker and web must deploy the same canonical commit.
- Worker startup uses the installed `tsx` binary directly; runtime must not invoke pnpm/Corepack.
- One worker acquires the PostgreSQL leadership lease; another remains standby.
- Full synchronization uses `sale.order.create_date` bounds with an exclusive end date.
- Missing salesperson records appear as `Atanmamış` and are never dropped.
- Source relation names that are false or inaccessible are preserved through explicit technical placeholders.
- Currency metadata is synchronized from `res.currency`; each order retains its own source currency.

## Canonical status semantics

- Gerçekleşti: `state = sale`.
- Açık: `state in (draft, sent)` and not expired.
- İptal: `state = cancel`.
- Süresi doldu: `state in (draft, sent)` and `validity_date` is in the past.
- Gerçekleşmedi: İptal + Süresi doldu for presentation; sub-status stays available in detail.
- `validity_date = null` is not automatically expired and must remain visible as a data-quality bucket.

## Currency rules

- Always preserve the real order `currency_id` and currency code.
- USD, EUR and TRY amounts may appear in the same report detail.
- Never sum mixed currencies into one monetary total.
- Do not add automatic currency conversion without an approved exchange-rate source, effective-date policy and audit rule.

## Post-MVP M5 decision

M5 adds four reports. Delivery order:

1. **M5.1 Açık ve Yaşlanan Teklifler**
2. **M5.2 Müşteri Teklif Geçmişi**
3. **M5.3 Personel Performansı**
4. **M5.4 Tekliften Siparişe Dönüşüm**

The first slice is Open and Aging Quotations because the current monthly report already includes personnel comparison, while an aging report adds distinct operational value immediately.

Detailed contract: `docs/development/M5_IMPLEMENTATION_PLAN.md`.

## M5.1 first slice

Build one substantial vertical slice rather than many tiny PRs:

- reusable report domain/result contract,
- PostgreSQL query service,
- JSON API,
- report route and dashboard entry,
- filters and active-filter summary,
- KPI and age/expiry breakdowns,
- salesperson/customer ownership tables,
- order drill-down,
- XLSX operational follow-up export,
- audit logging,
- authorization and business-unit scope tests,
- PostgreSQL fixture tests,
- Chromium flow.

PDF may be included only after the interactive report and XLSX are stable; do not block the first M5.1 acceptance on visual PDF refinement.

## Required canonical documents

Read these first in the new conversation:

- `docs/00_PROJECT_CANON.md`
- `docs/project-canon.yaml`
- `docs/02_PRODUCT_REQUIREMENTS.md`
- `docs/03_SYSTEM_ARCHITECTURE.md`
- `docs/04_ODOO_INTEGRATION.md`
- `docs/05_REPORTING_DOMAIN.md`
- `docs/07_UI_UX_DESIGN_SYSTEM.md`
- `docs/09_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/10_TEST_STRATEGY.md`
- `docs/11_ROADMAP.md`
- `docs/development/M4_EXIT_REPORT.md`
- `docs/development/POST_MVP_BACKLOG.md`
- `docs/development/M5_IMPLEMENTATION_PLAN.md`
- this transfer document.

## Engineering workflow

Use the established sequence:

1. verify current `main`, branches and open PRs,
2. create a focused branch,
3. implement a meaningful vertical slice,
4. open PR to `main`,
5. wait for all CI/workflow gates,
6. fix failures on the same branch,
7. squash merge,
8. fast-forward `develop` to the canonical merge commit,
9. do not claim production success until Coolify/runtime evidence exists.

## Known post-MVP backlog boundaries

Do not accidentally reopen the accepted MVP for these items:

- broad UI redesign,
- saved filter presets,
- configurable columns,
- corporate PDF branding and charts,
- unrestricted report builder,
- scheduled email delivery,
- predictive analytics.

These remain deliberate post-MVP packages and should be scheduled separately.
