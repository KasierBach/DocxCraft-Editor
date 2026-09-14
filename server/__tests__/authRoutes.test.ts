// @vitest-environment node
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccountService } from '../accountService.ts';
import { buildDocumentApiApp } from '../app.ts';
import type { OAuthProvider } from '../auth/providers.ts';
import { createDocumentStore } from '../documentStore.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { SessionService, SESSION_COOKIE_NAME } from '../session.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);
const BASE_URL = 'http://localhost:5136';

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

// A stand-in identity provider so the OAuth flow is exercised without network.
const stubProvider: OAuthProvider = {
  id: 'github',
  label: 'Stub',
  async createAuthorization(redirectUri) {
    return {
      url: `https://stub.example/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`,
      state: 'stub-state',
    };
  },
  async completeAuthorization({ query, state }) {
    if (query.state !== state) {
      throw new Error('state mismatch');
    }
    return {
      provider: 'github',
      providerAccountId: 'stub-1',
      email: 'stub@example.com',
      emailVerified: true,
      name: 'Stub User',
      avatarUrl: null,
    };
  },
};

function readCookie(setCookie: string | string[] | undefined, name: string) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = headers.find((header) => header.startsWith(`${name}=`));
  return match ? match.split(';')[0] : undefined;
}

// Skipped unless TEST_DATABASE_URL is set; expects migrations applied.
describe.skipIf(!hasDatabase)('auth routes (guest → sign-in)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the auth route tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

    app = buildDocumentApiApp({
      store: createDocumentStore({ rootDirectory: await mkdtemp(join(tmpdir(), 'docx-auth-')) }),
      staticDir: '',
      accounts: {
        accounts: new AccountService({ prisma }),
        sessions: new SessionService({ prisma, ttlMs: 60_000 }),
        providers: [stubProvider],
        baseUrl: BASE_URL,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await releaseLock();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
  });

  async function firstSession() {
    const response = await app.inject({ method: 'GET', url: '/api/auth/session' });
    return {
      cookie: readCookie(response.headers['set-cookie'], SESSION_COOKIE_NAME) as string,
      userId: (response.json() as { user: { id: string } }).user.id,
    };
  }

  it('mints a guest session, then signs in and merges the guest', async () => {
    // 1. First visit: no cookie → anonymous guest + session cookie.
    const first = await app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.authenticated).toBe(false);
    expect(firstBody.user.isAnonymous).toBe(true);
    expect(firstBody.providers).toEqual([{ id: 'github', label: 'Stub' }]);

    const guestCookie = readCookie(first.headers['set-cookie'], SESSION_COOKIE_NAME);
    expect(guestCookie).toBeDefined();

    // 2. Start OAuth: redirect to the provider with a state cookie.
    const start = await app.inject({
      method: 'GET',
      url: '/api/auth/github/start',
      headers: { cookie: guestCookie },
    });
    expect(start.statusCode).toBe(302);
    expect(start.headers.location).toContain('stub.example');
    const stateCookie = readCookie(start.headers['set-cookie'], 'docx_oauth_state');
    expect(stateCookie).toBeDefined();

    // 3. Callback: exchanges the code, links the account, merges the guest.
    const callback = await app.inject({
      method: 'GET',
      url: '/api/auth/github/callback?code=abc&state=stub-state',
      headers: { cookie: `${guestCookie}; ${stateCookie}` },
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe(BASE_URL);

    const signedInCookie = readCookie(callback.headers['set-cookie'], SESSION_COOKIE_NAME);
    expect(signedInCookie).toBeDefined();
    expect(signedInCookie).not.toBe(guestCookie);

    // 4. The new session is authenticated.
    const second = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: signedInCookie },
    });
    const secondBody = second.json();
    expect(secondBody.authenticated).toBe(true);
    expect(secondBody.user.isAnonymous).toBe(false);
    expect(secondBody.user.email).toBe('stub@example.com');

    // 5. The guest was merged away; one real account remains.
    expect(await prisma.user.count({ where: { isAnonymous: true } })).toBe(0);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.oAuthAccount.count()).toBe(1);
  });

  it('rejects a callback whose state does not match', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/github/callback?code=abc&state=wrong',
      headers: { cookie: 'docx_oauth_state=stub-state' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for an unknown provider', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/facebook/start' });
    expect(response.statusCode).toBe(404);
  });

  it('requires a session for account data', async () => {
    const exported = await app.inject({ method: 'GET', url: '/api/account/export' });
    expect(exported.statusCode).toBe(401);

    const deleted = await app.inject({ method: 'DELETE', url: '/api/account' });
    expect(deleted.statusCode).toBe(401);
  });

  it('exports the account as JSON', async () => {
    const session = await firstSession();

    const response = await app.inject({
      method: 'GET',
      url: '/api/account/export',
      headers: { cookie: session.cookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { user: { id: string }; documents: unknown[] };
    expect(body.user.id).toBe(session.userId);
    expect(Array.isArray(body.documents)).toBe(true);
  });

  it('deletes the account and its data', async () => {
    const session = await firstSession();

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/account',
      headers: { cookie: session.cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: session.userId } })).toBeNull();
  });
});
