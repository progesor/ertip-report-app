import { NextResponse } from 'next/server';

import { getAppDatabase } from '@/lib/database';
import { AuthorizationError, requirePermission } from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';
import { getSyncDatabase } from '@/lib/sync-database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error('INVALID_SYNC_DATE');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('INVALID_SYNC_DATE');
  }

  return value;
}

function validateRange(dateFrom: string | null, dateTo: string | null): void {
  if ((dateFrom === null) !== (dateTo === null)) {
    throw new Error('INCOMPLETE_SYNC_RANGE');
  }

  if (dateFrom !== null && dateTo !== null && dateTo <= dateFrom) {
    throw new Error('INVALID_SYNC_RANGE');
  }
}

export async function GET() {
  try {
    await requirePermission('admin:sync');
    const database = await getSyncDatabase();
    const runs = await database.getSaleOrderSyncRuns(15);
    return NextResponse.json(
      { ok: true, runs },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error('[sync] failed to read sync history', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Senkronizasyon geçmişi okunamadı.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requirePermission('admin:sync');
    const payload = (await request.json().catch(() => ({}))) as Readonly<Record<string, unknown>>;
    const dateFrom = normalizeDate(payload.dateFrom);
    const dateTo = normalizeDate(payload.dateTo);
    validateRange(dateFrom, dateTo);
    const database = await getSyncDatabase();
    const queued = await database.queueSaleOrderSync({
      requestedBy: user.id,
      dateFrom,
      dateTo,
      pageSize: 200,
    });

    try {
      const appDatabase = await getAppDatabase();
      await appDatabase.recordAudit({
        actorUserId: user.id,
        action: queued.created ? 'odoo.sync.queued' : 'odoo.sync.queue.reused',
        entityType: 'sync_run',
        entityId: queued.run.id,
        metadata: {
          dateFrom,
          dateTo,
          pageSize: queued.run.pageSize,
          status: queued.run.status,
        },
      });
    } catch (auditError) {
      console.error('[sync] failed to record queue audit', {
        name: auditError instanceof Error ? auditError.name : 'UnknownError',
      });
    }

    return NextResponse.json(
      { ok: true, created: queued.created, run: queued.run },
      {
        status: queued.created ? 202 : 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message === 'INVALID_SYNC_DATE') {
      return NextResponse.json(
        { ok: false, error: 'Senkronizasyon tarihi YYYY-AA-GG biçiminde olmalıdır.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'INCOMPLETE_SYNC_RANGE') {
      return NextResponse.json(
        { ok: false, error: 'Başlangıç ve bitiş tarihleri birlikte verilmelidir.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'INVALID_SYNC_RANGE') {
      return NextResponse.json(
        { ok: false, error: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır.' },
        { status: 400 },
      );
    }

    console.error('[sync] failed to queue sync run', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Senkronizasyon işi sıraya alınamadı.' },
      { status: 500 },
    );
  }
}
