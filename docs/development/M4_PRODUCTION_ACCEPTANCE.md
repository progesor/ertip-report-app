# M4 Production Acceptance

## Status

**Closed on 2026-07-26.** The MVP export and operational-readiness criteria are accepted.

## Export acceptance

| Check | Result | Evidence |
| --- | --- | --- |
| Filtered XLSX opens with 4 worksheets | Pass | Production file reviewed; workbook artifact tests reopen and inspect all worksheets. |
| XLSX detail count matches filtered screen scope | Pass | Complete-detail export query and PostgreSQL fixture coverage. |
| USD/EUR/TRY rows preserve source currency | Pass | Production review and mixed-currency reporting fixture. |
| Selected-person PDF opens and is readable | Pass for MVP | Production review after fixed-coordinate renderer in PR #18. Further visual refinement is post-MVP. |
| All-person PDF opens and is readable | Pass for MVP | Production review after fixed-coordinate renderer in PR #18. Further visual refinement is post-MVP. |
| Manager can export without Owner assistance | Pass | Server-side `reports:export` permission and authenticated Chromium export flow. |
| Export audit events recorded | Pass | PostgreSQL audit integration test and Owner audit-history surface. |

The product owner explicitly accepted the current XLSX and rebuilt PDF outputs as sufficient for the MVP. More advanced branding, graphics and pagination are tracked after MVP.

## Backup/restore rehearsal

- Rehearsal date: 2026-07-26
- Environment: isolated GitHub Actions PostgreSQL 17 databases; production was not modified
- Source schema version: `2`
- Backup format: PostgreSQL custom archive (`pg_dump --format=custom`)
- Backup size: `27,453` bytes
- Backup SHA-256: `e850d92dca9afe814686fc626d9059c1d4694b6497f2cfe85744aa302823d397`
- Restore target: fresh database created from `template0`
- Source signature:
  - sale orders: `1`
  - active users: `1`
  - audit events: `1`
  - latest reconciled sync run: `cccccccc-cccc-4ccc-8ccc-cccccccccccc`
  - deterministic fixture hash: `32d0eff00c181bedd01c5b6c5017623b`
- Restored signature: identical to source
- Result: **Pass**

The workflow publishes the dump, source/restore signatures, checksum and evidence report as a short-retention CI artifact. This proves that the application schema and representative local-only data can be backed up and restored without relying on Odoo.

## Rollback compatibility rehearsal

- Rehearsal date: 2026-07-26
- Current schema source: PR #19 merge-ref commit `0da87988dc5e9bee0284f348dec9c5d6bb4f47f1`
- Previous verified application commit: `71f5dd857cc3994aaa5e66e3b8849a5fd2f2f6c6`
- Previous web readiness on current schema: Pass
- Previous Owner bootstrap/session on current schema: Pass
- Previous monthly report API on current schema: Pass
- Previous worker startup on current schema: Pass
- Previous worker leadership lease on current schema: Pass
- Production services modified: No
- Observed interruption: None
- Result: **Pass**

A deliberate production rollback was not performed. For this small, administrator-only and read-only-Odoo MVP, isolated compatibility proof provides the required safety without creating avoidable production interruption. The emergency procedure still requires web and worker to be returned to the same canonical commit.

## Operational boundary

The automated rehearsal validates dump/restore mechanics and application rollback compatibility. It cannot verify the external Coolify backup scheduler. Daily PostgreSQL backup and an off-server encrypted copy remain mandatory production operations settings and must stay enabled.

## Exit decision

M4 is closed. The initial MVP is complete and usable in production. Remaining report, PDF and visual improvements move to the post-MVP backlog.
