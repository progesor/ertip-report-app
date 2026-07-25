# M3 Order Currency Handling

## Problem

The first M3 report preserved `sale.order.currency_id` in PostgreSQL but rendered every detail amount with the selected business unit's base currency code. For the international business unit this mislabeled EUR or TRY quotations as USD.

## Canonical behavior

- The business unit currency remains contextual metadata only (`Yurt Dışı` base currency: USD).
- Every quotation amount is rendered with its own synchronized `sale.order.currency_id` code.
- Amounts are never converted between USD, EUR and TRY in this report.
- Amounts in different currencies are not summed into one monetary KPI.
- Odoo remains read-only.

## Implementation

- Before a sale-order synchronization, the worker reads `res.currency` using `search_read` with `active_test=false`.
- Valid ISO currency codes are persisted locally in `app_meta` under `odoo_currency_code:<id>`.
- Existing `odoo_sale_orders.odoo_currency_id` values are used directly; sale-order rows do not need a schema rewrite.
- The report query resolves currency codes in this order:
  1. synchronized Odoo currency metadata;
  2. verified business-unit source-currency mapping;
  3. ISO `XXX` fallback until the next successful synchronization.

## Production acceptance

After deployment, run one full sale-order synchronization. Verify at least one USD, one EUR and one TRY quotation in the report detail table against Odoo. The displayed amount and currency must match the source quotation exactly.
