import type { Pool } from 'pg';

export async function recoverInterruptedSyncRuns(
  pool: Pool,
  staleAfterMinutes = 15,
): Promise<number> {
  const safeMinutes = Number.isInteger(staleAfterMinutes)
    ? Math.min(Math.max(staleAfterMinutes, 5), 120)
    : 15;
  const result = await pool.query<{ readonly id: string }>(
    `UPDATE sync_runs
     SET status = 'queued',
         started_at = NULL,
         safe_error_code = 'WORKER_INTERRUPTED',
         error_stage = 'worker-recovery',
         updated_at = now()
     WHERE kind = 'sale_order'
       AND status = 'running'
       AND updated_at < now() - ($1::text || ' minutes')::interval
     RETURNING id`,
    [String(safeMinutes)],
  );
  return result.rowCount ?? 0;
}
