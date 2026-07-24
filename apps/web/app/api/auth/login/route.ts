import { NextResponse } from 'next/server';

import {
  hashClientIdentifier,
  hashPassword,
  normalizeEmail,
  validateEmail,
  verifyPassword,
} from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';

import { getAppDatabase } from '@/lib/database';
import { issueSession, setSessionCookie } from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DUMMY_PASSWORD_HASH = hashPassword('InvalidPasswordPlaceholder2026');

interface LoginBody {
  readonly email?: unknown;
  readonly password?: unknown;
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function invalidCredentialsResponse(status = 401) {
  return NextResponse.json(
    { ok: false, error: 'E-posta veya parola doğrulanamadı.' },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const runtimeConfig = readRuntimeConfig();

    if (
      !runtimeConfig.database.configured ||
      !runtimeConfig.authentication.configured ||
      !runtimeConfig.authentication.sessionSecret
    ) {
      return NextResponse.json(
        { ok: false, error: 'Kimlik doğrulama altyapısı yapılandırılmamış.' },
        { status: 503 },
      );
    }

    const body = (await request.json()) as LoginBody;
    const email = normalizeEmail(readText(body.email));
    const password = readText(body.password);

    if (validateEmail(email) || password.length === 0 || password.length > 128) {
      await verifyPassword(password || 'invalid', await DUMMY_PASSWORD_HASH);
      return invalidCredentialsResponse();
    }

    const database = await getAppDatabase();
    const user = await database.findUserByEmail(email);

    if (!user) {
      await verifyPassword(password, await DUMMY_PASSWORD_HASH);
      await database.recordAudit({
        actorUserId: null,
        action: 'auth.login.failed',
        metadata: {
          reason: 'invalid-credentials',
          emailFingerprint: hashClientIdentifier(
            email,
            runtimeConfig.authentication.sessionSecret,
          ),
        },
      });
      return invalidCredentialsResponse();
    }

    if (user.status !== 'active') {
      await verifyPassword(password, await DUMMY_PASSWORD_HASH);
      await database.recordAudit({
        actorUserId: user.id,
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'disabled-account' },
      });
      return invalidCredentialsResponse();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await verifyPassword(password, await DUMMY_PASSWORD_HASH);
      await database.recordAudit({
        actorUserId: user.id,
        action: 'auth.login.blocked',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'temporary-lockout' },
      });
      return NextResponse.json(
        { ok: false, error: 'Hesap geçici olarak kilitli. Bir süre sonra tekrar deneyin.' },
        { status: 429 },
      );
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      const lockedUntil = await database.recordLoginFailure(user.id);
      await database.recordAudit({
        actorUserId: user.id,
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          reason: 'invalid-credentials',
          lockoutActivated: Boolean(lockedUntil),
        },
      });
      return lockedUntil
        ? NextResponse.json(
            { ok: false, error: 'Çok fazla hatalı deneme. Hesap 15 dakika kilitlendi.' },
            { status: 429 },
          )
        : invalidCredentialsResponse();
    }

    await database.recordLoginSuccess(user.id);
    await database.recordAudit({
      actorUserId: user.id,
      action: 'auth.login.succeeded',
      entityType: 'user',
      entityId: user.id,
      metadata: { role: user.role },
    });

    const session = await issueSession(user.id, request);
    const response = NextResponse.json({
      ok: true,
      user: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });
    setSessionCookie(response, session);
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ ok: false, error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
    }

    console.error('[auth] login failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Giriş işlemi tamamlanamadı.' },
      { status: 500 },
    );
  }
}
