import { NextResponse } from 'next/server';

import { getAppDatabase } from '@/lib/database';
import {
  clearSessionCookie,
  deleteCurrentSession,
  getCurrentSession,
} from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const currentUser = await getCurrentSession();

    if (currentUser) {
      const database = await getAppDatabase();
      await database.recordAudit({
        actorUserId: currentUser.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: currentUser.id,
      });
    }

    await deleteCurrentSession();
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
    }

    console.error('[auth] logout failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    const response = NextResponse.json(
      { ok: false, error: 'Çıkış işlemi tamamlanamadı.' },
      { status: 500 },
    );
    clearSessionCookie(response);
    return response;
  }
}
