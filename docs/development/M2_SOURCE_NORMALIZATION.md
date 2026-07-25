# M2 Odoo JSON-2 Source Normalization

## Trigger

The first production full synchronization reached Odoo successfully but stopped on the first page with:

```text
INVALID_SOURCE_RECORD / page-read
```

The failed run did not write to Odoo and did not perform stale-row deletion.

## Normalization policy

Odoo 19 JSON-2 reads are requested with `load: null` for `search_read` and `read`. This avoids loading display names for many2one fields and keeps the transfer payload limited to source identifiers.

The synchronization parser accepts these safe source representations:

- many2one relation as a raw integer ID,
- legacy/read-compatible many2one tuple `[id, display_name]`,
- object-shaped relation containing an `id`,
- numeric values as finite JSON numbers,
- numeric values as canonical numeric strings.

Unset optional relations continue to normalize to `NULL`. Required fields still fail closed.

## Safe validation diagnostics

An invalid required field produces only these runtime diagnostics:

- `sourceRecordId`,
- `sourceField`,
- `sourceValueType`.

The worker does not log customer names, salesperson names, order labels, amounts, authorization headers, API keys, or raw source values.

Example:

```json
{
  "event": "worker.sync.failed",
  "safeErrorCode": "INVALID_SOURCE_RECORD",
  "errorStage": "page-read",
  "sourceRecordId": 123,
  "sourceField": "currency_id",
  "sourceValueType": "false"
}
```

## Required production validation

After deployment:

1. queue a new full synchronization,
2. confirm the worker progresses beyond cursor `0`,
3. confirm `processedCount` increases,
4. confirm final source/local reconciliation is true,
5. repeat the full synchronization and confirm no duplicate local rows.

If another source incompatibility appears, use only the safe diagnostic triplet above to extend the explicit normalization policy. Do not skip records silently.
