# M2 Odoo Sync Core

## Purpose

This slice converts the verified Odoo tenant mapping into a durable, idempotent local synchronization pipeline. Odoo remains strictly read-only; all writes occur only in the application PostgreSQL database.

## Architecture

```text
Owner browser
  -> POST /api/owner/sync-runs
  -> PostgreSQL sync_runs (queued)
  -> ertip-report-worker
  -> Odoo JSON-2 read-only API
  -> PostgreSQL upserts
  -> source/local reconciliation
  -> Owner sync history
```

The web process never performs the long-running Odoo transfer inside the request lifecycle. It only validates and queues a durable job. The worker claims queued jobs with `FOR UPDATE SKIP LOCKED` semantics.

## Canonical mappings

| Business unit | Local UUID | Odoo company | Currency |
| --- | --- | ---: | --- |
| Yurt Dışı | `11111111-1111-4111-8111-111111111111` | `1` | USD / currency `1` |
| Yurt İçi | `22222222-2222-4222-8222-222222222222` | `25` | TRY / currency `31` |

Runtime filtering uses the stable `res.company.id`. Company names are never mapping keys.

## Database schema version 2

New persisted surfaces:

- verified Odoo columns on `business_units`,
- `sync_runs`,
- `odoo_salespeople`,
- `odoo_customers`,
- `odoo_sale_orders`.

The source identity for a sale order is its Odoo record ID in the single canonical database. Customer and salesperson source identities are their Odoo IDs.

`odoo_sale_orders.odoo_salesperson_id` is nullable. A missing source `user_id` remains `NULL` and is rendered by reporting as **Atanmamış**.

## Queue and recovery

Only one sale-order sync may be queued or running at a time. A duplicate Owner request returns the existing active run instead of creating competing work.

A run stores:

- requested scope,
- source-ID cursor,
- source count,
- processed/upsert counters,
- source and local reconciliation JSON,
- stale-row deletion count,
- safe error code and stage,
- request/start/completion timestamps.

A worker restart recovers a run that has remained `running` without an update for 15 minutes. The same run ID and cursor are preserved, so already persisted pages are not duplicated.

## Odoo read contract

Allowed methods remain:

- `search_count`,
- `search_read`,
- `read`.

The worker reads sale orders in ascending source-ID pages. Each page fetches only the referenced customer and salesperson records required for that page.

Sale-order fields:

- `id`,
- `company_id`,
- `user_id`,
- `partner_id`,
- `currency_id`,
- `state`,
- `create_date`,
- `date_order`,
- `validity_date`,
- `amount_total`,
- `write_date`.

No Odoo create, write, unlink, action, or workflow method is available in the adapter allowlist.

## Retry policy

Transient failures are retried up to four attempts with bounded backoff:

- timeout,
- network error,
- rate limit,
- temporary Odoo unavailability.

Authentication, authorization, invalid request, unsupported state, unmapped company, and invalid source-record failures are not hidden by retry.

## Idempotency and stale records

Every source entity uses `INSERT ... ON CONFLICT ... DO UPDATE`.

Each synchronized order is marked with the current `sync_run_id`. Stale local orders are deleted only after:

1. all source pages have completed,
2. the worker enters finalization,
3. deletion is limited to the run's selected `create_date` scope.

A failed or interrupted scan never deletes stale rows.

## Reconciliation

At finalization the worker compares source and local counts for:

- total sale orders,
- `draft`,
- `sent`,
- `sale`,
- `cancel`,
- missing salesperson,
- each mapped company.

A run is `succeeded` only when the normalized count structures match. A mismatch closes the run as `failed` with `RECONCILIATION_FAILED` while retaining the diagnostic counts.

## Owner API

```text
GET  /api/owner/sync-runs
POST /api/owner/sync-runs
```

Both require `admin:sync`. POST also requires same-origin validation.

Empty POST body queues a full sync:

```json
{}
```

A bounded `create_date` scope uses an exclusive end date:

```json
{
  "dateFrom": "2026-07-01",
  "dateTo": "2026-08-01"
}
```

## Production deployment

Two Coolify applications must track the same repository branch and commit:

### Web

- Dockerfile: `Dockerfile`
- public HTTP service
- command from image

### Worker

- Dockerfile: `Dockerfile.worker`
- no public domain or port
- same `DATABASE_URL`, `DATABASE_SSL`, `ODOO_BASE_URL`, `ODOO_DATABASE`, and `ODOO_API_KEY`
- `APP_ENV=production`

The API key remains a Coolify runtime secret and is never baked into either image.

## First production validation

1. Deploy web and worker from the same commit.
2. Confirm database schema version is `2`.
3. Queue **İlk Tam Senkronizasyonu Başlat**.
4. Confirm the worker claims the job.
5. Expected source baseline:
   - total `6,875`,
   - company `1`: `3,085`,
   - company `25`: `3,790`,
   - missing salesperson: `2`.
6. Confirm run status `succeeded` and reconciliation `true`.
7. Queue the same full sync again.
8. Confirm the second run also succeeds with the same totals and without duplicated local rows.

## Open items after this slice

- operational confirmation of the API-key owner user ID,
- live `validity_date` samples for expired/open normalization,
- first production sync evidence,
- local reporting queries for M3.
