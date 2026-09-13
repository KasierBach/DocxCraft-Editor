import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'docxcraft_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

const SCRYPT_KEY_LENGTH = 32;

/** Produces a `scrypt:<salt>:<hash>` string for AUTH_PASSPHRASE_HASH. */
export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(passphrase, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassphrase(input: string, stored: string): boolean {
  const [scheme, salt, expectedHex] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(input, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionKey(passphraseHash: string): Buffer {
  // Derives a stable HMAC key from the stored hash so sessions invalidate
  // automatically whenever the passphrase changes, without extra secrets.
  return scryptSync(passphraseHash, 'docxcraft-session-key', SCRYPT_KEY_LENGTH);
}

export function createSessionToken(passphraseHash: string): string {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const signature = createHmac('sha256', sessionKey(passphraseHash))
    .update(expiresAt)
    .digest('hex');
  return `${expiresAt}.${signature}`;
}

export function verifySessionToken(token: string | undefined, passphraseHash: string): boolean {
  if (!token) {
    return false;
  }

  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) {
    return false;
  }

  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now()) {
    return false;
  }

  const expected = createHmac('sha256', sessionKey(passphraseHash)).update(expiresAt).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

export function readSessionCookie(requestHeaders: Record<string, unknown>): string | undefined {
  const cookieHeader = requestHeaders.cookie;
  const value = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  if (typeof value !== 'string') {
    return undefined;
  }

  for (const part of value.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return rest.join('=') || undefined;
    }
  }

  return undefined;
}

export function createSessionCookie(token: string, requestHeaders: Record<string, unknown>): string {
  const isHttps = requestHeaders['x-forwarded-proto'] === 'https';
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(isHttps ? ['Secure'] : []),
  ].join('; ');
}

export function createClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
