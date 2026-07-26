# M5 Source-Currency Closeout

## Goal

Close M5 by extending the accepted Monthly Quotation Performance, Customer Quotation History and Open/Aging Quotations reports with source-currency monetary analysis.

## Rules

- Existing quotation count, status and scope semantics remain unchanged.
- Monetary calculations reuse `currency-amount-metrics`.
- USD, EUR, TRY and any other source currencies remain separate.
- No automatic FX conversion or mixed-currency grand total is allowed.
- Screen, JSON API and XLSX must consume the same extended report result.
- Live report requests continue to read local PostgreSQL only.

## Acceptance

- current and previous monthly amounts reconcile by source currency,
- customer history exposes quotation/realized/open/not-realized amounts,
- open-aging exposes tracked/open/expired operational amounts,
- nested salesperson, customer and trend/distribution rows carry the same currency-separated metrics,
- unit, PostgreSQL and Chromium checks pass,
- M5.5 frontend redesign remains the mandatory next phase before M6.
