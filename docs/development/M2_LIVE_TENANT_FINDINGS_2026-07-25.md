# M2 Live Tenant Findings — 2026-07-25

## 1. Run identity

- Environment: production
- Application URL: `https://report.progesor.net/`
- Odoo tenant: Ertip Medical Odoo Online
- Detected version: `19.0+e`
- Discovery time: 25 July 2026, 18:29 Europe/Istanbul
- Initial discovery duration: 4,034 ms
- Access policy: read-only JSON-2 methods only

No API key, authorization header, raw customer content, or full login value is retained in this document.

## 2. Verified company mapping

The two Odoo companies have nearly identical names. Punctuation or name suffixes must not be used as the application mapping key.

| Application business unit | Stable Odoo company ID | Odoo company name | Source currency |
| --- | ---: | --- | --- |
| Yurt Dışı | `1` | Er Tıbbi Ürünler Sağlık Hiz. Paz. ve Dış Tic. Ltd. Şti. | USD (`res.currency.id = 1`) |
| Yurt İçi | `25` | Er Tıbbi Ürünler Sağlık Hiz. Paz. ve Dış Tic. Ltd. Şti | TRY (`res.currency.id = 31`) |

Canonical rule:

```text
business_unit -> res.company.id
Yurt Dışı -> 1
Yurt İçi   -> 25
```

The company name and currency are verification aids only. Runtime filtering and local foreign keys must use the stable company ID.

## 3. Multi-company visibility

- Two `res.company` records are readable.
- Fifteen `res.users` records are visible.
- Five visible users list both company IDs `1` and `25` in `company_ids`.
- The discovery screen lists visible user candidates; it does not prove which record owns the runtime API key.
- The API-key principal must be confirmed operationally before its Odoo user ID is persisted as integration metadata.

The aggregate `sale.order` count is `6,875`. Company-specific row counts are collected by the Owner-only coverage diagnostics endpoint introduced after the first live discovery.

## 4. Model and field inventory

All required models were readable:

| Model | Total fields | Studio/custom fields | Required target gaps |
| --- | ---: | ---: | --- |
| `res.company` | 243 | 0 | none |
| `res.users` | 316 | 0 | none |
| `res.partner` | 223 | 0 | none |
| `res.currency` | 24 | 0 | none |
| `sale.order` | 144 | 0 | none |

No `x_` or `x_studio_` field exists on `sale.order`. The first report must therefore be derived from standard Odoo fields unless the tenant model changes later.

Verified critical `sale.order` fields:

- `user_id` — salesperson
- `partner_id` — customer
- `company_id` — company/business-unit source
- `currency_id` — source currency
- `state` — `draft`, `sent`, `sale`, `cancel`
- `create_date` — immutable quotation cohort timestamp
- `date_order` — order/confirmation-sensitive timestamp
- `amount_total`
- `validity_date`
- `write_date`
- `team_id`

## 5. Quotation date semantics

The live tenant confirms `create_date` as the canonical quotation cohort field.

Observed evidence from 100 confirmed orders:

- 55 records had `date_order` later than `create_date`.
- 4 records crossed a calendar-month boundary.
- Maximum observed difference: 147.86 days.
- Evidence record IDs retained internally by the Owner discovery result: `7016`, `6984`, `7019`, `7075`, `6990`, `7076`, `7073`, `7070`, `7069`, `6758`.

Canonical metric rule:

```text
quotation cohort month = month(sale.order.create_date)
confirmation/order month = month(sale.order.date_order) for confirmed orders
```

A quotation must not move to another production month merely because it later becomes a sales order.

## 6. State and data-quality baseline

The resilient re-run completed all four source-state counts:

| Source state | Label | Record count |
| --- | --- | ---: |
| `draft` | Quotation | 1,088 |
| `sent` | Quotation Sent | 1 |
| `sale` | Sales Order | 5,717 |
| `cancel` | Cancelled | 69 |
| **Total** |  | **6,875** |

Reconciliation:

```text
1,088 + 1 + 5,717 + 69 = 6,875
```

The source-state distribution therefore fully reconciles to the aggregate `sale.order` count. The earlier `sent` and `sale` incomplete reads were transient upstream failures, not zero values. The bounded sequential retry closed this issue without changing the read-only policy.

Critical missing-value baseline:

- missing `user_id`: 2
- missing `partner_id`: 0
- missing `company_id`: 0
- missing `currency_id`: 0
- missing `create_date`: 0
- missing `date_order`: 0

The two records without `user_id` require a read-only record-level inspection before salesperson aggregation rules are finalized. They must initially normalize to an explicit `unassigned` salesperson bucket rather than being silently discarded.

## 7. Status normalization boundary

Source states are verified, but the reporting business status remains versioned separately:

- `sale` -> Gerçekleşti
- active `draft` / `sent` -> Açık
- `cancel` -> İptal
- expired `draft` / `sent` -> Süresi doldu
- Gerçekleşmedi -> İptal + Süresi doldu in summary views, with the detailed sub-status retained

The exact expiration calculation and treatment of missing `validity_date` must be validated on live records before M3.

## 8. Owner-only coverage diagnostics

The next diagnostics surface is:

```text
GET /api/owner/odoo/coverage
```

It requires the `admin:data-quality` permission and returns only safe reporting metadata:

- global total and state counts,
- company-specific total and state counts,
- reconciliation status for company IDs `1` and `25`,
- missing-salesperson count by company,
- up to 20 unassigned record IDs with company, state, `create_date`, and `date_order` only.

It does not read or return customer names, quotation names, monetary values, order lines, full logins, or API secrets.

## 9. Next M2 verification slice

1. Run `GET /api/owner/odoo/coverage` in the authenticated Owner session and record company-specific totals.
2. Confirm that both company distributions reconcile to their own total and together reconcile to `6,875`.
3. Review the safe metadata for the two records with missing `user_id` and finalize the `unassigned` rule.
4. Confirm the Odoo user record that owns the runtime API key.
5. Sample expired and non-expired `draft`/`sent` records to finalize status normalization.
6. Persist company mappings and begin the idempotent local sync schema only after these checks close.
