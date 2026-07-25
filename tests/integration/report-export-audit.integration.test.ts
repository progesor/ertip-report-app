import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import { AppDatabase, createDatabasePool, ensureDatabaseSchema } from '@ertip/db';

const connectionString = process.env.DATABASE_URL?.trim();

test(
  'persists safe report export audit metadata without report content',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const database = new AppDatabase(pool);
    const userId = randomUUID();
    const requestId = randomUUID();

    try {
      await ensureDatabaseSchema(pool);
      await pool.query(
        `INSERT INTO users (
           id, email, display_name, password_hash, role, status
         ) VALUES ($1, $2, 'Export Audit User', 'test-hash', 'owner', 'active')`,
        [userId, `export-audit-${userId}@example.test`],
      );
      await database.recordAudit({
        actorUserId: userId,
        action: 'report.export.xlsx',
        entityType: 'report_definition',
        entityId: 'international-monthly-quotation-performance',
        businessUnitScope: '11111111-1111-4111-8111-111111111111',
        metadata: {
          requestId,
          dateFrom: '2026-07-01',
          dateTo: '2026-08-01',
          status: 'all',
          detailCount: 42,
        },
      });
      const result = await pool.query<{
        action: string;
        entity_id: string;
        safe_metadata_json: Record<string, unknown>;
      }>(
        `SELECT action, entity_id, safe_metadata_json
         FROM audit_logs
         WHERE actor_user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];

      assert.ok(row);
      assert.equal(row.action, 'report.export.xlsx');
      assert.equal(row.entity_id, 'international-monthly-quotation-performance');
      assert.equal(row.safe_metadata_json.requestId, requestId);
      assert.equal(row.safe_metadata_json.detailCount, 42);
      assert.equal('customerName' in row.safe_metadata_json, false);
      assert.equal('amountTotal' in row.safe_metadata_json, false);
    } finally {
      await pool.query('DELETE FROM audit_logs WHERE actor_user_id = $1', [userId]).catch(() => undefined);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => undefined);
      await pool.end();
    }
  },
);
