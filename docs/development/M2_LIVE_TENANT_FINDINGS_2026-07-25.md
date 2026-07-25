# M2 Live Tenant Findings — 2026-07-25

## 1. Run identity

- Environment: production
- Application URL: `https://report.progesor.net/`
- Odoo tenant: Ertip Medical Odoo Online
- Detected version: `19.0+e`
- Discovery time: 25 July 2026, 18:29 Europe/Istanbul
- Initial discovery duration: 4,034 ms
- Coverage diagnostics time: 25 July 2026, 19:32 Europe/Istanbul
- Coverage diagnostics duration: 6,917 ms
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

The company name and currency are verification aids only. Runtime filtering and local foreign keys use the stable company ID.

## 3. Multi-company visibility and row coverage

- Two `res.company` records are readable.
- Fifteen `res.users` records are visible.
- Five visible users list both company IDs `1` and `25` in `company_ids`.
- The discovery screen lists visible user candidates; it does not prove which record owns the runtime API key.
- The API-key principal must be confirmed operationally before its Odoo user ID is persisted as integration metadata.

The aggregate `sale.order` count is `6,875`. The Owner-only coverage diagnostics produced this complete company reconciliation:

| Business unit | Company ID | Quotation | Sent | Sales Order | Cancelled | Total | Missing salesperson |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Yurt Dışı | `1` | 796 | 1 | 2,258 | 30 | **3,085** | 1 |
| Yurt İçi | `25` | 292 | 0 | 3,459 | 39 | **3,790** | 1 |
| **All** |  | **1,088** | **1** | **5,717** | **69** | **6,875** | **2** |

Reconciliation:

```text
796 + 1 + 2,258 + 30 = 3,085
292 + 0 + 3,459 + 39 = 3,790
3,085 + 3,790 = 6,875
```

Both companies reconcile internally and together reconcile to the global source count.

## 4. Model and field inventory

All required models were readable:

| Model | Total fields | Studio/custom fields | Required target gaps |
| --- | ---: | ---: | --- |
| `res.company` | 243 | 0 | none |
| `res.users` | 316 | 0 | none |
| `res.partner` | 223 | 0 | none |
| `res.currency` | 24 | 0 | none |
| `sale.order` | 144 | 0 | none |

No `x_` or `x_studio_` field exists on `sale.order`. The first report is derived from standard Odoo fields unless the tenant model changes later.

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

The source-state distribution fully reconciles to the aggregate `sale.order` count. The earlier incomplete `sent` and `sale` reads were transient upstream failures, not zero values.

Critical missing-value baseline:

- missing `user_id`: 2
- missing `partner_id`: 0
- missing `company_id`: 0
- missing `currency_id`: 0
- missing `create_date`: 0
- missing `date_order`: 0

## 7. Unassigned salesperson decision

The two records without `user_id` were inspected with safe technical metadata only:

| Odoo record | Company | State | `create_date` | `date_order` | Decision |
| --- | ---: | --- | --- | --- | --- |
| `#6460` | `25` / Yurt İçi | `sale` | 2026-06-09 14:02:19 | 2026-06-09 14:02:20 | Keep and aggregate under **Atanmamış** |
| `#734` | `1` / Yurt Dışı | `draft` | 2025-05-17 08:22:48 | 2025-05-17 08:10:25 | Keep under **Atanmamış**; flag date-order anomaly |

Canonical rule:

```text
sale.order.user_id = false -> local salesperson_id = NULL -> report bucket = Atanmamış
```

The application does not modify these records in Odoo and does not silently discard them. Record `#734` also demonstrates that `date_order` can precede `create_date`; this reinforces the decision not to use `date_order` as the quotation cohort field.

## 8. Status normalization boundary

Source states are verified, but the reporting business status remains versioned separately:

- `sale` -> Gerçekleşti
- active `draft` / `sent` -> Açık
- `cancel` -> İptal
- expired `draft` / `sent` -> Süresi doldu
- Gerçekleşmedi -> İptal + Süresi doldu in summary views, with the detailed sub-status retained

The exact expiration calculation and treatment of missing `validity_date` remain the final discovery item before the first production report.

## 9. M2 sync-core handoff

The discovery and coverage phase is complete enough to persist the verified mappings and start the idempotent local synchronization layer.

The sync-core implementation uses:

- PostgreSQL schema version 2,
- stable company-to-business-unit mappings,
- durable `sync_runs` queue,
- separate worker process,
- source-ID cursor pagination,
- bounded retry for transient Odoo failures,
- customer, salesperson, and `sale.order` upserts,
- explicit `NULL` salesperson preservation,
- stale local row removal only after a complete successful scan,
- source-versus-local company/state reconciliation,
- Owner sync history and queue controls.

## 10. Remaining live verification

1. Deploy both web and worker images from the same canonical commit.
2. Run the first full synchronization and confirm local totals match `6,875`, `3,085`, and `3,790`.
3. Re-run the full synchronization and confirm idempotency with the same source totals.
4. Confirm the Odoo user record that owns the runtime API key.
5. Sample expired and non-expired `draft`/`sent` records to finalize `validity_date` normalization.
