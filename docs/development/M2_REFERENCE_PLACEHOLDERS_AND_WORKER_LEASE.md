# M2 Reference Placeholders and Worker Lease

## Live production evidence

The first production transfer passed 1,200 `sale.order` rows and stopped safely while resolving an Odoo reference:

```text
sourceRecordId: 1537
sourceField: name
sourceValueType: false
```

This proves the sale-order row itself was readable. The incompatible value belonged to a referenced `res.partner` or `res.users` record whose `name` was unset (`false`). Odoo data was not modified, and stale local rows were not deleted because finalization was never reached.

The same production log also showed two run IDs processing concurrently. The application must remain safe even if Coolify temporarily retains two worker containers during a rolling deployment or if legacy queued rows exist.

## Reference normalization policy

A missing display name is not a reason to discard a sale order.

| Reference state | Local display name |
| --- | --- |
| record readable and name populated | original Odoo name |
| record readable and `name=false`/empty | `İsimsiz müşteri · Odoo #<id>` or `İsimsiz kullanıcı · Odoo #<id>` |
| referenced ID not returned by Odoo `read` | `Erişilemeyen müşteri · Odoo #<id>` or `Erişilemeyen kullanıcı · Odoo #<id>` |

The Odoo source ID remains canonical. Placeholder labels are explicit diagnostics, not inferred customer or employee identities. A later synchronization replaces a placeholder automatically when the source record becomes readable or gains a name.

Required sale-order fields remain fail-closed. This tolerance applies only to reference metadata that is not required to identify, scope, count, or reconcile the sale order.

## Single-worker leadership

Each worker container attempts to hold a PostgreSQL session advisory lock dedicated to sale-order synchronization.

- One container logs `worker.lease.acquired` and may claim queued work.
- Additional containers log `worker.lease.standby` and remain healthy without claiming runs.
- The lock is released automatically if the database session or container exits.
- A standby retries periodically and becomes leader after the former leader releases the lock.
- Interrupted-run recovery is performed only by the active leader.

This protects synchronization during Coolify rolling deployments, duplicate containers, and manual scale-out without relying on container naming or deployment timing.

## CI regression gates

The worker lease workflow starts two production worker images against the same PostgreSQL database and requires:

1. both containers remain running,
2. exactly one `worker.lease.acquired` event,
3. exactly one `worker.lease.standby` event,
4. no sync starts when the queue is empty.

The existing worker runtime gate still runs the image with a read-only root filesystem to prevent Corepack, pnpm, or dependency installation from returning at runtime.

## Production validation

After deployment:

1. confirm one container reports `worker.lease.acquired`,
2. confirm any overlapping old container reports `worker.lease.standby` or is removed by Coolify,
3. queue one new full synchronization,
4. verify progress passes cursor `#1.303` and processed count `1.200`,
5. verify the run completes at `6.875` rows with company totals `3.085` and `3.790`,
6. run the same full synchronization again to confirm idempotency.
