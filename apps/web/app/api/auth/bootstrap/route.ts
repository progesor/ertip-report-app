import { NextResponse } from 'next/server';

import {
  hashPassword,
  normalizeEmail,
  secureCompareSecrets,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';

import { getAppDatabase } from '@/lib/database';
import { issueSession, setSessionCookie } from '@/lib/server-auth';
import { assertSameOrigin, RequestSecurityError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface BootstrapBody {
  readonly displayName?: unknown;
  readonly email?: unknown;
  readonly password?: unknown;
  readonly bootstrapToken?: unknown;
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const runtimeConfig = readRuntimeConfig();

    if (
      !runtimeConfig.database.configured ||
      !runtimeConfig.authentication.configured ||
      !runtimeConfig.authentication.bootstrapConfigured ||
      !runtimeConfig.authentication.sessionSecret ||
      !runtimeConfig.authentication.ownerBootstrapToken
    ) {
      return NextResponse.json(
        { ok: false, error: 'Kurulum için gerekli runtime secret değerleri eksik.' },
        { status: 503 },
      );
    }

    const body = (await request.json()) as BootstrapBody;
    const displayName = readText(body.displayName).trim();
    const email = normalizeEmail(readText(body.email));
    const password = readText(body.password);
    const bootstrapToken = readText(body.bootstrapToken);
    const validationErrors = [
      validateDisplayName(displayName),
      validateEmail(email),
      ...validatePassword(password),
    ].filter((value): value is string => Boolean(value));

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { ok: false, error: validationErrors[0], details: validationErrors },
        { status: 400 },
      );
    }

    const database = await getAppDatabase();

    if ((await database.countUsers()) > 0) {
      return NextResponse.json(
        { ok: false, error: 'İlk Owner hesabı daha önce oluşturulmuş.' },
        { status: 409 },
      );
    }

    if (
      !secureCompareSecrets(
        bootstrapToken,
        runtimeConfig.authentication.ownerBootstrapToken,
        runtimeConfig.authentication.sessionSecret,
      )
    ) {
      await database.recordAudit({
        actorUserId: null,
        action: 'owner.bootstrap.failed',
        metadata: { reason: 'invalid-bootstrap-token' },
      });
      return NextResponse.json(
        { ok: false, error: 'Kurulum doğrulaması başarısız.' },
        { status: 401 },
      );
    }

    const user = await database.createInitialOwner({
      email,
      displayName,
      passwordHash: await hashPassword(password),
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'İlk Owner hesabı başka bir işlem tarafından oluşturuldu.' },
        { status: 409 },
      );
    }

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

    console.error('[auth] owner bootstrap failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { ok: false, error: 'Owner hesabı oluşturulamadı.' },
      { status: 500 },
    );
  }
}
