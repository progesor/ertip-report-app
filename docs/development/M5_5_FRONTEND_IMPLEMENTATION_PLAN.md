# M5.5 Frontend Redesign — Implementation Plan

## Status

**Active.** M5 closed at commit `0641a63fbe20b5f0eed0949226a56c6060eeb9c1`. Phase 1 is closed at `344afa7d5a17fccd7f1f8e5526d321ee3a2e3090`. M6 remains blocked until this plan is completed and accepted in production for Owner and Manager sessions.

## Frozen boundaries

M5.5 may restructure presentation and frontend architecture, but must preserve:

- all accepted report URLs and URL-driven filters,
- report count, status, date-axis and source-currency semantics,
- JSON response populations,
- XLSX/PDF output populations,
- Owner/Manager permissions and server-enforced business-unit scope,
- PostgreSQL-only interactive report queries,
- safe audit metadata rules.

## Delivery phases

### Phase 1 — Foundation and information architecture

**Status: Closed.**

Delivered:

- canonical report catalog,
- `/reports` central report library,
- shared role-aware workspace shell foundation,
- persistent dashboard navigation,
- removal of the floating quick-report panel,
- corrected roadmap state and frozen route inventory,
- five-report unit and Chromium coverage.

### Phase 2 — Shared report shell

**Status: Active implementation; acceptance tracked in PR #30.**

Scope:

- extract duplicated report sidebars, headers and user blocks,
- introduce breadcrumbs, report metadata and shared action areas,
- standardize filter bars and active-filter summaries,
- integrate source-currency amount surfaces into the normal report flow,
- migrate all five report screens without changing result contracts.

Delivered implementation surface:

- shared `ReportWorkspaceFrame` with breadcrumb and report context,
- all five direct report routes inside the role-aware workspace shell,
- customer and personnel directory routes inside the same shell,
- legacy report sidebars and topbars removed from the visible interaction flow,
- source-currency amount tables moved from fixed drawers into normal report content,
- one screen heading hierarchy with print titles preserved,
- sticky desktop filter bars and responsive report-context layout,
- seven-route Chromium shell coverage.

Exit: individual reports no longer expose separate application navigation or temporary floating amount drawers, and report/API/export regressions remain green.

### Phase 3 — Shared analytical components

- standardize KPI cards, comparison indicators and explanatory metadata,
- introduce shared chart frames, data tables, status badges and drill-down patterns,
- create consistent empty, error and loading states,
- improve dense-table responsive behavior,
- preserve print/PDF separation.

Exit: all report screens use the same visual and interaction primitives.

### Phase 4 — Owner administration

- move Odoo connection diagnostics into a dedicated Owner route,
- move tenant discovery, synchronization and data-quality surfaces into administration routes,
- provide a coherent audit-log route inside the new shell,
- keep Manager navigation free of technical controls,
- retain all existing authorization checks and safe diagnostics.

Exit: dashboard/report users are not exposed to technical operations unless their role and route require it.

### Phase 5 — Accessibility, responsive and production acceptance

- keyboard and focus-order review,
- semantic landmark and heading review,
- reduced-motion support,
- desktop, tablet and mobile breakpoint acceptance,
- Owner and Manager authenticated Chromium flows,
- full API/export regression,
- production deployment and manual acceptance.

Exit: M5.5 is closed only after the deployed frontend is accepted for both roles. M6 can then begin.
