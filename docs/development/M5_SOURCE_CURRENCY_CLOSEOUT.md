# M5 Source-Currency Closeout

## Status

**Closed on 26 July 2026.** This package completes the M5 reporting contract. M5.5 Complete Frontend Redesign is the mandatory next phase before M6.

## Delivered scope

The accepted Monthly Quotation Performance, Customer Quotation History and Open/Aging Quotations reports now include source-currency monetary analysis.

## Frozen rules

- Existing quotation count, status, filter and server-side scope semantics remain unchanged.
- Monetary calculations reuse the exact-decimal `currency-amount-metrics` engine.
- USD, EUR, TRY and any other source currencies remain separate.
- No automatic FX conversion or mixed-currency grand total is allowed.
- Screen, JSON API and XLSX consume the same extended report result.
- Live report requests continue to read local PostgreSQL only.
- Export audit metadata may include currency codes but never customer names or monetary values.

## Acceptance evidence

- current and previous monthly amounts reconcile by source currency,
- customer history exposes quotation, realized, open and not-realized amounts,
- open-aging exposes tracked, currently open and expired operational amounts,
- nested salesperson, customer, month, age and validity rows carry separated amount metrics,
- dedicated XLSX amount-analysis sheets are generated,
- unit, PostgreSQL fixture, Chromium and authenticated audit checks pass,
- web/worker production images, Worker Lease, PDF Preview, backup/restore and rollback compatibility pass.

## Frontend boundary

The M5 screens retain intentionally minimal amount-analysis drawers. M5.5 will replace the fragmented shell and temporary navigation surfaces while preserving the frozen report, API, export, currency and authorization contracts. M6 must not begin until the redesigned frontend is accepted in Owner and Manager production sessions.
