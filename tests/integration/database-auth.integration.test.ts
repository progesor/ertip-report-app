import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '@ertip/auth';
import { AppDatabase, createDatabasePool } from '@ertip/db';

const connectionString = process.env.DATABASE_URL?.trim();

async function resetMutableTables(database: AppDatabase): Promise<void> {
  const pool = createDatabasePool({
    connectionString: connectionString ?? 'postgresql://invalid',
    ssl: false,
    maxConnections: 1,
  });

  try {
    await pool.query(
      `TRUNCATE TABLE
         odoo_connection_checks,
         audit_logs,
         sessions,
         user_business_unit_scopes,
         users
       RESTART IDENTITY CASCADE`,
    );
  } finally {
    await pool.end();
  }

  await database.migrate();
}

test(
  'database schema supports owner, login lockout, sessions and Odoo checks',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const database = new AppDatabase(
      createDatabasePool({ connectionString, ssl: false, maxConnections: 2 }),
    );

    try {
      await database.migrate();
      await resetMutableTables(database);

      assert.equal(await database.getSchemaVersion(), database.currentSchemaVersion);
      assert.equal(await database.countUsers(), 0);

      const passwordHash = await hashPassword('OwnerPassword2026');
      const owner = await database.createInitialOwner({
        email: 'owner@ertipmedical.com',
        displayName: 'Test Owner',
        passwordHash,
      });

      assert.ok(owner);
      assert.equal(owner.role, 'owner');
      assert.equal(await database.countUsers(), 1);
      assert.equal(
        await database.createInitialOwner({
          email: 'another-owner@ertipmedical.com',
          displayName: 'Another Owner',
          passwordHash,
        }),
        null,
      );

      const storedOwner = await database.findUserByEmail('OWNER@ERTIPMEDICAL.COM');
      assert.ok(storedOwner);
      assert.equal(await verifyPassword('OwnerPassword2026', storedOwner.passwordHash), true);

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        assert.equal(await database.recordLoginFailure(owner.id), null);
      }

      const lockedUntil = await database.recordLoginFailure(owner.id);
      assert.ok(lockedUntil);
      assert.ok(lockedUntil.getTime() > Date.now());

      await database.recordLoginSuccess(owner.id);
      const resetOwner = await database.findUserById(owner.id);
      assert.ok(resetOwner);
      assert.equal(resetOwner.failedLoginCount, 0);
      assert.equal(resetOwner.lockedUntil, null);
      assert.ok(resetOwner.lastLoginAt);

      const sessionToken = createSessionToken();
      const sessionSecret = 'integration-session-secret-2026-value';
      const tokenHash = hashSessionToken(sessionToken, sessionSecret);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await database.createSession({
        userId: owner.id,
        tokenHash,
        expiresAt,
        ipHash: 'ip-hash',
        userAgent: 'integration-test',
      });

      const session = await database.findSessionByTokenHash(tokenHash);
      assert.ok(session);
      assert.equal(session.userId, owner.id);
      assert.equal(session.role, 'owner');
      assert.deepEqual(session.allowedBusinessUnitIds.length, 2);

      await database.recordOdooConnectionCheck({
        checkedBy: owner.id,
        status: 'success',
        serverVersion: '19.0',
        companyCount: 2,
        durationMs: 42,
        safeErrorCode: null,
      });
      const latestCheck = await database.getLatestOdooConnectionCheck();
      assert.ok(latestCheck);
      assert.equal(latestCheck.companyCount, 2);

      await database.deleteSessionByTokenHash(tokenHash);
      assert.equal(await database.findSessionByTokenHash(tokenHash), null);
    } finally {
      await database.close();
    }
  },
);
