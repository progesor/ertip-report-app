import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const runtime = getSafeRuntimeStatus(readRuntimeConfig());
  const ready = runtime.demoMode || runtime.odoo.configured;

  return NextResponse.json(
    {
      status: ready ? 'ready' : 'degraded',
      checks: {
        application: 'ok',
        odooConfiguration: runtime.odoo.configured ? 'configured' : 'missing-secret',
        demoMode: runtime.demoMode,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
