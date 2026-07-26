# M4 Exit Report — Exports and Production Readiness

## Decision

**M4 closed on 2026-07-26. Initial MVP complete.**

## Delivered

### Management outputs

- filtered XLSX with `Özet`, `Personel`, `Müşteriler` and `Teklif Detayı` worksheets,
- selected-salesperson PDF,
- all-salesperson PDF,
- browser print view,
- source USD/EUR/TRY preservation without implicit conversion,
- export audit events and Owner audit-history view.

### PDF acceptance correction

The first PDF implementation was rejected during production review because of clipping, cursor drift, broken pagination and missing Turkish glyphs. PR #18 replaced it with a fixed-coordinate A4 landscape renderer, repeated continuation headers, deterministic page breaks and production-pinned DejaVu Sans fonts.

The rebuilt PDFs were accepted as sufficient for the MVP. Additional branding, graphics and visual refinement remain post-MVP work.

### Operational safeguards

- repeatable isolated PostgreSQL `pg_dump → pg_restore` rehearsal,
- deterministic source/restore signature comparison,
- backup size and SHA-256 evidence,
- previous verified web image tested against the current schema,
- previous Owner bootstrap/session and monthly report API tested against the current schema,
- previous verified worker startup and PostgreSQL leadership lease tested against the current schema,
- no deliberate production outage or production database mutation during rehearsal.

## Acceptance evidence

### Production usage

- two consecutive full Odoo synchronizations completed with `6,875 / 6,875` reconciliation,
- live monthly report accepted,
- mixed quotation currencies accepted,
- XLSX accepted,
- rebuilt selected-person and all-person PDFs accepted for MVP.

### Automated operations rehearsal

M4 Operations Rehearsal run `30182678059` completed both jobs successfully:

- `backup_restore`: pass,
- `rollback_compatibility`: pass.

Backup/restore evidence:

- schema version: `2`,
- archive size: `27,453` bytes,
- SHA-256: `e850d92dca9afe814686fc626d9059c1d4694b6497f2cfe85744aa302823d397`,
- source and restored fixture hash: `32d0eff00c181bedd01c5b6c5017623b`,
- all compared counts and latest reconciled sync ID identical.

Rollback evidence:

- previous application commit: `71f5dd857cc3994aaa5e66e3b8849a5fd2f2f6c6`,
- web readiness: pass,
- Owner bootstrap/session: pass,
- monthly report API: pass,
- worker startup: pass,
- worker leadership lease: pass.

## Residual operational requirement

CI proves backup/restore mechanics but cannot inspect the Coolify scheduler. Production must retain:

- daily PostgreSQL backups,
- an encrypted off-server copy,
- periodic manual confirmation that recent backup jobs are succeeding.

This is an operations setting, not an open application-development milestone.

## Post-MVP handoff

The next delivery phase starts with M5 Additional Reports. Existing report/PDF visual improvements should be bundled with post-MVP UX work rather than reopening M4.
