import { getSafeRuntimeStatus, readRuntimeConfig } from '@ertip/config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ...getSafeRuntimeStatus(readRuntimeConfig()),
    build: {
      version: process.env.npm_package_version ?? '0.1.0',
      commit: process.env.GIT_COMMIT_SHA ?? null,
    },
    timestamp: new Date().toISOString(),
  });
}
