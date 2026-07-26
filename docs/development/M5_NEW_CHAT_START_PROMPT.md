# Ertip Report App — M5 New Conversation Start Prompt

Ertip Report App geliştirmesine post-MVP **M5 — Additional Reports** aşamasından devam ediyoruz.

## Repository

- Repository: `progesor/ertip-report-app`
- Canonical branch: `main`
- Expected baseline commit:
  - `2d3d0da3594228033febb0ab90cc29329452210b`
  - `chore(m4): close MVP with isolated operations rehearsals (#19)`

Kod yazmadan önce GitHub’daki güncel `main` commit’ini, `develop` dalını ve açık PR’ları doğrula. Beklenen commit’ten farklıysa farkı açıkça bildir ve güncel repository içeriğini kanonik kaynak kabul et.

## Read first

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
- `docs/development/PROJECT_TRANSFER_POST_MVP_M5.md`

## Authoritative product state

- Initial MVP is closed.
- Production: `https://report.progesor.net/`
- Odoo Online Custom, version `19.0+e`.
- Odoo access is read-only JSON-2.
- One Odoo database contains two companies:
  - company `1` = Yurt Dışı,
  - company `25` = Yurt İçi.
- Roles: Owner and Manager only; no employee access.
- Reports use local PostgreSQL; browser/report requests never query Odoo directly.
- Two consecutive full production syncs reconciled `6,875 / 6,875`.
- Existing first report, XLSX, PDF, audit, backup/restore rehearsal and rollback compatibility are accepted MVP baseline.

## Canonical reporting rules

- Quotation cohort: `sale.order.create_date`.
- Confirmation timing: `sale.order.date_order`, only for realized orders.
- Gerçekleşti: `state = sale`.
- Açık: `state in (draft, sent)` and not expired.
- İptal: `state = cancel`.
- Süresi doldu: draft/sent and `validity_date` is past.
- Gerçekleşmedi: İptal + Süresi doldu.
- `validity_date = null` must stay visible and must not be silently treated as expired.
- Per-order currencies USD/EUR/TRY are preserved; mixed currencies are not summed or converted.

## M5 delivery order

1. M5.1 Açık ve Yaşlanan Teklifler
2. M5.2 Müşteri Teklif Geçmişi
3. M5.3 Personel Performansı
4. M5.4 Tekliften Siparişe Dönüşüm

## Start with M5.1

Implement a substantial vertical slice for **Açık ve Yaşlanan Teklifler**:

- reusable report/result contract,
- local PostgreSQL query service,
- JSON API,
- authenticated report route and dashboard entry,
- business-unit/person/customer/age/expiry filters,
- age buckets `0–7`, `8–14`, `15–30`, `31–60`, `61–90`, `90+`,
- validity groups: valid, nearing expiry, overdue, validity date missing,
- KPI summary and age/expiry distribution,
- salesperson/customer ownership tables,
- quotation detail drill-down,
- source currency per row,
- filtered XLSX operational follow-up export,
- export audit event,
- server-side business-unit scope enforcement,
- unit, PostgreSQL integration, authorization and Chromium tests.

Use existing report/export infrastructure where appropriate, but do not duplicate the M3 metric logic or weaken the accepted MVP behavior.

PDF can follow after the interactive report and XLSX are accepted; do not spend the first slice on cosmetic PDF refinement.

## Workflow

Use branch → PR → all CI gates → squash merge → synchronize `develop`.

Do not claim production deployment or production acceptance until Coolify/runtime evidence is provided.

The user prefers larger coherent slices and has delegated implementation sequencing and technical decisions. Proceed autonomously, but surface real ambiguities or production risks clearly.
