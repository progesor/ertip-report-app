# M5.5 Frontend Redesign — Implementation Plan

## Status

**Active.** M5 closed at commit `0641a63fbe20b5f0eed0949226a56c6060eeb9c1`. M6 remains blocked until this plan is completed and accepted in production for Owner and Manager sessions.

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

- establish a canonical report catalog,
- add `/reports` as the central report library,
- introduce the shared role-aware workspace shell,
- replace the floating report shortcut with persistent navigation,
- correct roadmap state and freeze route inventory,
- validate all five accepted report links.

Exit: the report library is discoverable from the dashboard, works for authenticated and demo sessions, and every direct report route remains valid.

### Phase 2 — Shared report shell

- extract duplicated report sidebars, headers and user blocks,
- introduce breadcrumbs, report metadata and shared action areas,
- standardize filter bars and active-filter summaries,
- integrate source-currency amount surfaces into the normal report flow,
- migrate all five report screens without changing result contracts.

Exit: individual reports no longer render their own application navigation or temporary floating amount drawers.

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

## Phase 1 delivered surface

The first implementation branch introduces:

- canonical report catalog data,
- shared `WorkspaceShell`,
- centralized `/reports` library,
- persistent dashboard navigation to the report library,
- removal of the fixed quick-report panel,
- report catalog unit tests and Chromium navigation coverage.
