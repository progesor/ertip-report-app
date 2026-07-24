import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';
import { NextResponse } from 'next/server';

import { getDatabaseHealth } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const runtime = getSafeRuntimeStatus(readRuntimeConfig());

  if (runtime.demoMode) {
    return NextResponse.json({
      status: 'ready',
      checks: {
        application: 'ok',
        database: 'demo-mode',
        authentication: 'demo-mode',
        odooConfiguration: runtime.odoo.configured ? 'configured' : 'optional-in-demo',
        demoMode: true,
      },
      timestamp: new Date().toISOString(),
    });
  }

  const database = await getDatabaseHealth();
  const infrastructureConfigured =
    database.configured && runtime.authentication.configured && runtime.odoo.configured;
  const ready = !database.configured || database.reachable;

  return NextResponse.json(
    {
      status: ready ? (infrastructureConfigured ? 'ready' : 'setup-required') : 'degraded',
      checks: {
        application: 'ok',
        database: !database.configured
          ? 'missing-configuration'
          : database.reachable
            ? 'reachable'
            : 'unreachable',
        databaseSchemaVersion: database.schemaVersion,
        authentication: runtime.authentication.configured ? 'configured' : 'missing-secret',
        ownerBootstrap: runtime.authentication.bootstrapConfigured ? 'configured' : 'optional-after-bootstrap',
        odooConfiguration: runtime.odoo.configured ? 'configured' : 'missing-secret',
        demoMode: false,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
