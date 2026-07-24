import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

import {
  can,
  createSessionToken,
  hashSessionToken,
  type AppPermission,
  type AppRole,
} from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';

import { getAppDatabase } from './database';
import { getClientIpHash, getSafeUserAgent } from './security';

export const SESSION_COOKIE_NAME = 'ertip_session';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AppRole;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly sessionId: string;
  readonly sessionExpiresAt: Date;
}

export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: Date;
}

export class AuthorizationError extends Error {
  public constructor(
    message: string,
    public readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

function getSessionSecret(): string | null {
  const runtime = readRuntimeConfig();
  return runtime.authentication.configured ? (runtime.authentication.sessionSecret ?? null) : null;
}

export async function issueSession(userId: string, request: Request): Promise<IssuedSession> {
  const runtime = readRuntimeConfig();
  const sessionSecret = getSessionSecret();

  if (!sessionSecret) {
    throw new AuthorizationError('Session security is not configured.', 403);
  }

  const database = await getAppDatabase();
  const token = createSessionToken();
  const expiresAt = new Date(
    Date.now() + runtime.authentication.sessionTtlHours * 60 * 60 * 1000,
  );

  await database.createSession({
    userId,
    tokenHash: hashSessionToken(token, sessionSecret),
    expiresAt,
    ipHash: getClientIpHash(request),
    userAgent: getSafeUserAgent(request),
  });

  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, session: IssuedSession): void {
  const runtime = readRuntimeConfig();

  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: runtime.appEnvironment === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
    priority: 'high',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  const runtime = readRuntimeConfig();

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: runtime.appEnvironment === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
    priority: 'high',
  });
}

export async function getCurrentSession(): Promise<AuthenticatedUser | null> {
  const sessionSecret = getSessionSecret();

  if (!sessionSecret) {
    return null;
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const database = await getAppDatabase();
  const session = await database.findSessionByTokenHash(hashSessionToken(token, sessionSecret));

  if (!session) {
    return null;
  }

  return {
    id: session.userId,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    allowedBusinessUnitIds: session.allowedBusinessUnitIds,
    sessionId: session.sessionId,
    sessionExpiresAt: session.expiresAt,
  };
}

export async function deleteCurrentSession(): Promise<void> {
  const sessionSecret = getSessionSecret();

  if (!sessionSecret) {
    return;
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return;
  }

  const database = await getAppDatabase();
  await database.deleteSessionByTokenHash(hashSessionToken(token, sessionSecret));
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentSession();

  if (!user) {
    throw new AuthorizationError('Authentication required.', 401);
  }

  return user;
}

export async function requirePermission(permission: AppPermission): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (!can(user.role, permission)) {
    throw new AuthorizationError('Permission denied.', 403);
  }

  return user;
}
