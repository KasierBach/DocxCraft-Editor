import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createClearCookie,
  createSessionCookie,
  createSessionToken,
  hashPassphrase,
  readSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  verifyPassphrase,
  verifySessionToken,
} from '../auth.ts';

const PASSPHRASE = 'correct horse battery staple';

describe('passphrase hashing', () => {
  it('produces an scrypt hash with a unique salt per call', () => {
    const first = hashPassphrase(PASSPHRASE);
    const second = hashPassphrase(PASSPHRASE);

    expect(first).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  it('verifies the correct passphrase', () => {
    expect(verifyPassphrase(PASSPHRASE, hashPassphrase(PASSPHRASE))).toBe(true);
  });

  it('rejects a wrong passphrase', () => {
    expect(verifyPassphrase('wrong passphrase', hashPassphrase(PASSPHRASE))).toBe(false);
  });

  it('rejects malformed stored hashes instead of throwing', () => {
    for (const stored of ['', 'not-a-hash', 'scrypt::', 'bcrypt:abc:def', 'scrypt:abc']) {
      expect(verifyPassphrase(PASSPHRASE, stored)).toBe(false);
    }
  });
});

describe('session tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a freshly created token', () => {
    const hash = hashPassphrase(PASSPHRASE);
    expect(verifySessionToken(createSessionToken(hash), hash)).toBe(true);
  });

  it('rejects a token signed with a different passphrase hash', () => {
    const token = createSessionToken(hashPassphrase(PASSPHRASE));
    expect(verifySessionToken(token, hashPassphrase('another passphrase'))).toBe(false);
  });

  it('rejects a tampered expiry payload', () => {
    const hash = hashPassphrase(PASSPHRASE);
    const [expiry, signature] = createSessionToken(hash).split('.');
    const tampered = `${Number(expiry) + 60_000}.${signature}`;

    expect(verifySessionToken(tampered, hash)).toBe(false);
  });

  it('rejects expired, malformed, and missing tokens', () => {
    vi.useFakeTimers();
    const hash = hashPassphrase(PASSPHRASE);
    const token = createSessionToken(hash);

    expect(verifySessionToken(undefined, hash)).toBe(false);
    expect(verifySessionToken('', hash)).toBe(false);
    expect(verifySessionToken('garbage', hash)).toBe(false);
    expect(verifySessionToken('123.not-hex', hash)).toBe(false);

    vi.advanceTimersByTime(SESSION_TTL_MS + 1000);
    expect(verifySessionToken(token, hash)).toBe(false);
  });
});

describe('session cookies', () => {
  it('reads the session token from a multi-cookie header', () => {
    expect(
      readSessionCookie({ cookie: `theme=dark; ${SESSION_COOKIE_NAME}=abc.def; other=1` }),
    ).toBe('abc.def');
  });

  it('returns undefined when the cookie is absent or unusable', () => {
    expect(readSessionCookie({})).toBe(undefined);
    expect(readSessionCookie({ cookie: 'theme=dark' })).toBe(undefined);
    expect(readSessionCookie({ cookie: 42 })).toBe(undefined);
  });

  it('marks the cookie HttpOnly, SameSite=Strict, with a max age', () => {
    const cookie = createSessionCookie('token', {});

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=token`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_MS / 1000}`);
    expect(cookie).not.toContain('Secure');
  });

  it('adds the Secure flag only behind HTTPS', () => {
    expect(createSessionCookie('token', { 'x-forwarded-proto': 'https' })).toContain('Secure');
    expect(createSessionCookie('token', { 'x-forwarded-proto': 'http' })).not.toContain('Secure');
  });

  it('clears the cookie immediately on sign out', () => {
    const cleared = createClearCookie();

    expect(cleared).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cleared).toContain('Max-Age=0');
  });
});
