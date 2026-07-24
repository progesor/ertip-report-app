import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';
import { NextResponse } from 'next/server';

import { getAppDatabase, getDatabaseHealth } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const runtime = getSafeRuntimeStatus(readRuntimeConfig());
  const database = await getDatabaseHealth();
  let latestOdooCheck: {
    readonly status: 'success' | 'failure';
    readonly serverVersion: string | null;
    readonly companyCount: number | null;
    readonly durationMs: number;
    readonly safeErrorCode: string | null;
    readonly checkedAt: string;
  } | null = null;

  if (database.reachable) {
    try {
      const check = await (await getAppDatabase()).getLatestOdooConnectionCheck();
      latestOdooCheck = check ? { ...check, checkedAt: check.checkedAt.toISOString() } : null;
    } catch (error) {
      console.error('[system-status] failed to read latest Odoo check', {
        name: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  return NextResponse.json({
    ...runtime,
    database: {
      ...runtime.database,
      reachable: database.reachable,
      schemaVersion: database.schemaVersion,
      userCount: database.userCount,
      errorCode: database.errorCode,
    },
    latestOdooCheck,
    build: {
      version: process.env.npm_package_version ?? '0.1.0',
      commit: process.env.GIT_COMMIT_SHA ?? null,
    },
    timestamp: new Date().toISOString(),
  });
}
