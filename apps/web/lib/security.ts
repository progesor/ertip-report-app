import { hashClientIdentifier, sanitizeUserAgent } from '@ertip/auth';
import { readRuntimeConfig } from '@ertip/config';

export class RequestSecurityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

function getExpectedOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost ?? firstHeaderValue(request.headers.get('host')) ?? requestUrl.host;
  const forwardedProtocol = firstHeaderValue(request.headers.get('x-forwarded-proto'));
  const protocol = forwardedProtocol ?? requestUrl.protocol.replace(':', '');

  return `${protocol}://${host}`;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');

  if (!origin || new URL(origin).origin !== getExpectedOrigin(request)) {
    throw new RequestSecurityError('Cross-origin state change rejected.');
  }
}

export function getClientIpHash(request: Request): string | null {
  const runtime = readRuntimeConfig();
  const sessionSecret = runtime.authentication.sessionSecret;

  if (!sessionSecret) {
    return null;
  }

  const clientIdentifier =
    firstHeaderValue(request.headers.get('cf-connecting-ip')) ??
    firstHeaderValue(request.headers.get('x-forwarded-for')) ??
    firstHeaderValue(request.headers.get('x-real-ip')) ??
    'unknown';

  return hashClientIdentifier(clientIdentifier, sessionSecret);
}

export function getSafeUserAgent(request: Request): string | null {
  return sanitizeUserAgent(request.headers.get('user-agent'));
}
