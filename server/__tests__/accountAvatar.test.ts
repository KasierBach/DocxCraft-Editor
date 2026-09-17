// @vitest-environment node
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountService } from '../accountService.ts';
import { buildDocumentApiApp } from '../app.ts';
import { AuditService } from '../audit.ts';
import { createDocumentStore } from '../documentStore.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { SessionService, SESSION_COOKIE_NAME } from '../session.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);
const BASE_URL = 'http://localhost:5136';

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

/**
 * The avatar route exists because the browser cannot load a Google profile photo
 * directly: Google answers the hotlink with a 429 HTML page, which Chromium's
 * ORB then refuses to render as an image. These cover the two things that
 * matter - it never fetches an arbitrary host, and it only serves real images.
 */
describe.skipIf(!hasDatabase)('account avatar', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the account avatar tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

    app = buildDocumentApiApp({
      store: createDocumentStore({
        rootDirectory: await mkdtemp(join(tmpdir(), 'docx-avatar-')),
      }),
      staticDir: '',
      accounts: {
        accounts: new AccountService({ prisma }),
        sessions: new SessionService({ prisma, ttlMs: 60_000 }),
        providers: [],
        baseUrl: BASE_URL,
        audit: new AuditService({ prisma }),
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startSession() {
    const response = await app.inject({ method: 'GET', url: '/api/auth/session' });
    const setCookie = response.headers['set-cookie'];
    const headers = Array.isArray(setCookie) ? setCookie : [setCookie];
    const match = headers.find((header) => header?.startsWith(`${SESSION_COOKIE_NAME}=`));

    return {
      cookie: match?.split(';')[0] as string,
      userId: (response.json() as { user: { id: string } }).user.id,
    };
  }

  async function setAvatar(userId: string, avatarUrl: string) {
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  }

  it('requires a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/account/avatar' });

    expect(response.statusCode).toBe(401);
  });

  it('answers 404 when the account has no provider avatar', async () => {
    const { cookie } = await startSession();

    const response = await app.inject({
      method: 'GET',
      url: '/api/account/avatar',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it('refuses a host that is not a provider avatar host, without fetching it', async () => {
    const { cookie, userId } = await startSession();
    await setAvatar(userId, 'https://169.254.169.254/latest/meta-data/');

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await app.inject({
      method: 'GET',
      url: '/api/account/avatar',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(404);
    // The important half: no request leaves the server at all.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves a provider avatar from our own origin', async () => {
    const { cookie, userId } = await startSession();
    await setAvatar(userId, 'https://lh3.googleusercontent.com/a/example=s96-c');

    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
    const fetchSpy = vi.fn(
      async () => new Response(bytes, { headers: { 'content-type': 'image/jpeg' } }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const response = await app.inject({
      method: 'GET',
      url: '/api/account/avatar',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/jpeg');
    expect(response.headers['cache-control']).toContain('private');
    expect(response.rawPayload).toEqual(Buffer.from(bytes));
  });

  it('refuses an upstream response that is not an image', async () => {
    const { cookie, userId } = await startSession();
    await setAvatar(userId, 'https://avatars.githubusercontent.com/u/1?v=4');

    // A provider rate-limiting with an HTML page must never reach the browser
    // presented as a photo.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>429</html>', { headers: { 'content-type': 'text/html' } }),
      ),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/account/avatar',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 when the provider request fails', async () => {
    const { cookie, userId } = await startSession();
    await setAvatar(userId, 'https://avatars.githubusercontent.com/u/1?v=4');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/account/avatar',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(404);
  });
});
