// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccountService } from '../accountService.ts';
import { buildDocumentApiApp } from '../app.ts';
import { ACTIVITY_DEFAULT_LIMIT, AuditService } from '../audit.ts';
import { readCookies } from '../cookies.ts';
import { createDocumentStore } from '../documentStore.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { SessionService, SESSION_COOKIE_NAME, hashSessionToken } from '../session.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);
const BASE_URL = 'http://localhost:5136';

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function readCookie(setCookie: string | string[] | undefined, name: string) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = headers.find((header) => header.startsWith(`${name}=`));
  return match ? match.split(';')[0] : undefined;
}

// Skipped unless TEST_DATABASE_URL is set; expects migrations applied.
describe.skipIf(!hasDatabase)('account profile routes', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let sessionService: SessionService;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the account profile route tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    sessionService = new SessionService({ prisma, ttlMs: 60_000 });

    app = buildDocumentApiApp({
      store: createDocumentStore({
        rootDirectory: await mkdtemp(join(tmpdir(), 'docx-account-profile-')),
      }),
      staticDir: '',
      accounts: {
        accounts: new AccountService({ prisma }),
        sessions: sessionService,
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

  /** Mints a fresh guest session, optionally with a specific user agent. */
  async function startSession(userAgent: string | null = null) {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { 'user-agent': userAgent ?? undefined },
    });
    expect(response.statusCode).toBe(200);
    return {
      cookie: readCookie(response.headers['set-cookie'], SESSION_COOKIE_NAME) as string,
      userId: (response.json() as { user: { id: string } }).user.id,
    };
  }

  function tokenFromCookie(cookie: string) {
    return readCookies(cookie)[SESSION_COOKIE_NAME] as string;
  }

  async function sessionIdForToken(token: string) {
    const row = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });
    return row.id;
  }

  /** Creates another real session for the user, backdated so ordering is stable. */
  async function addSession(userId: string, ageMs = 0) {
    const { token } = await sessionService.createForUser(userId, {
      userAgent: null,
      ip: '10.0.0.1',
    });
    if (ageMs > 0) {
      await prisma.session.update({
        where: { tokenHash: hashSessionToken(token) },
        data: { createdAt: new Date(Date.now() - ageMs) },
      });
    }
    return token;
  }

  function createAuditEvent(actorUserId: string, createdAt: Date, action = 'document.create') {
    return prisma.auditEvent.create({ data: { actorUserId, action, createdAt } });
  }

  it('requires a session for every account profile route', async () => {
    const responses = [
      await app.inject({ method: 'PATCH', url: '/api/account', payload: { displayName: 'Alice' } }),
      await app.inject({ method: 'GET', url: '/api/account/sessions' }),
      await app.inject({ method: 'DELETE', url: '/api/account/sessions' }),
      await app.inject({ method: 'DELETE', url: `/api/account/sessions/${randomUUID()}` }),
      await app.inject({ method: 'GET', url: '/api/account/activity' }),
    ];

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  describe('PATCH /api/account', () => {
    it('trims the value and returns the public user shape', async () => {
      const { cookie, userId } = await startSession();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/account',
        headers: { cookie },
        payload: { displayName: '  Alice  ' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toEqual({
        id: userId,
        email: null,
        name: 'Alice',
        avatarUrl: null,
        isAnonymous: true,
      });
      expect(Object.keys(body).sort()).toEqual(['avatarUrl', 'email', 'id', 'isAnonymous', 'name']);

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(stored.name).toBe('Alice');
    });

    it('records an account.profile_update audit row for the caller', async () => {
      const { cookie, userId } = await startSession();

      await app.inject({
        method: 'PATCH',
        url: '/api/account',
        headers: { cookie },
        payload: { displayName: 'Alice' },
      });

      const rows = await prisma.auditEvent.findMany({
        where: { actorUserId: userId, action: 'account.profile_update' },
      });
      expect(rows).toHaveLength(1);
    });

    it('rejects missing, blank, non-string, and overlong names', async () => {
      const { cookie } = await startSession();

      const payloads = [
        {},
        { displayName: '   ' },
        { displayName: 123 },
        { displayName: 'a'.repeat(81) },
      ];

      for (const payload of payloads) {
        const response = await app.inject({
          method: 'PATCH',
          url: '/api/account',
          headers: { cookie },
          payload,
        });
        expect(response.statusCode).toBe(400);
      }
    });

    it('accepts a name of exactly 80 characters', async () => {
      const { cookie } = await startSession();
      const name = 'a'.repeat(80);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/account',
        headers: { cookie },
        payload: { displayName: name },
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as { name: string }).name).toBe(name);
    });
  });

  describe('GET /api/account/sessions', () => {
    it("lists only the caller's sessions, newest first, with exactly one current", async () => {
      const current = await startSession(CHROME_WINDOWS_UA);
      const currentId = await sessionIdForToken(tokenFromCookie(current.cookie));

      const olderOne = await addSession(current.userId, 60_000);
      const olderTwo = await addSession(current.userId, 120_000);
      const olderOneId = await sessionIdForToken(olderOne);
      const olderTwoId = await sessionIdForToken(olderTwo);

      const other = await startSession();
      await addSession(other.userId, 30_000);

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/sessions',
        headers: { cookie: current.cookie },
      });

      expect(response.statusCode).toBe(200);
      const rows = response.json() as Array<{
        id: string;
        createdAt: string;
        expiresAt: string;
        ip: string | null;
        device: string;
        isCurrent: boolean;
      }>;

      expect(rows.map((row) => row.id)).toEqual([currentId, olderOneId, olderTwoId]);
      expect(rows.filter((row) => row.isCurrent)).toHaveLength(1);
      expect(rows.find((row) => row.isCurrent)?.id).toBe(currentId);

      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual([
          'createdAt',
          'device',
          'expiresAt',
          'id',
          'ip',
          'isCurrent',
        ]);
        expect(row).not.toHaveProperty('tokenHash');
        expect(row.createdAt).toBe(new Date(row.createdAt).toISOString());
        expect(row.expiresAt).toBe(new Date(row.expiresAt).toISOString());
      }
      expect(JSON.stringify(rows)).not.toContain('tokenHash');
    });

    it('labels a known browser and an absent user agent', async () => {
      const chrome = await startSession(CHROME_WINDOWS_UA);
      const unknown = await startSession();

      const chromeRows = (
        await app.inject({
          method: 'GET',
          url: '/api/account/sessions',
          headers: { cookie: chrome.cookie },
        })
      ).json() as Array<{ device: string; isCurrent: boolean }>;
      expect(chromeRows).toHaveLength(1);
      expect(chromeRows[0]?.isCurrent).toBe(true);
      expect(chromeRows[0]?.device).toBe('Chrome on Windows');
      expect((chromeRows[0]?.device ?? '').length).toBeGreaterThan(0);

      const unknownRows = (
        await app.inject({
          method: 'GET',
          url: '/api/account/sessions',
          headers: { cookie: unknown.cookie },
        })
      ).json() as Array<{ device: string; isCurrent: boolean }>;
      expect(unknownRows).toHaveLength(1);
      expect(unknownRows[0]?.isCurrent).toBe(true);
      expect(unknownRows[0]?.device).toBe('Unknown device');
    });
  });

  describe('DELETE /api/account/sessions/:sessionId', () => {
    it("revokes an owned session, 404s for another user's, and leaves it resolving", async () => {
      const caller = await startSession();
      const targetToken = await addSession(caller.userId);
      const targetId = await sessionIdForToken(targetToken);

      const other = await startSession();
      const foreignToken = await addSession(other.userId);
      const foreignId = await sessionIdForToken(foreignToken);

      const foreign = await app.inject({
        method: 'DELETE',
        url: `/api/account/sessions/${foreignId}`,
        headers: { cookie: caller.cookie },
      });
      expect(foreign.statusCode).toBe(404);
      expect(await sessionService.resolve(foreignToken)).not.toBeNull();

      const missing = await app.inject({
        method: 'DELETE',
        url: `/api/account/sessions/${randomUUID()}`,
        headers: { cookie: caller.cookie },
      });
      expect(missing.statusCode).toBe(404);

      const revoked = await app.inject({
        method: 'DELETE',
        url: `/api/account/sessions/${targetId}`,
        headers: { cookie: caller.cookie },
      });
      expect(revoked.statusCode).toBe(204);
      expect(await sessionService.resolve(targetToken)).toBeNull();
      expect(await prisma.session.findUnique({ where: { id: targetId } })).toBeNull();
    });
  });

  describe('DELETE /api/account/sessions', () => {
    it('revokes every other session and keeps the caller signed in', async () => {
      const caller = await startSession();
      const first = await addSession(caller.userId, 1_000);
      const second = await addSession(caller.userId, 2_000);

      const other = await startSession();
      const otherToken = await addSession(other.userId);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/account/sessions',
        headers: { cookie: caller.cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ revoked: 2 });
      expect(await sessionService.resolve(first)).toBeNull();
      expect(await sessionService.resolve(second)).toBeNull();
      expect(await sessionService.resolve(tokenFromCookie(caller.cookie))).not.toBeNull();
      expect(await sessionService.resolve(otherToken)).not.toBeNull();
    });
  });

  describe('GET /api/account/activity', () => {
    it("returns only the caller's events, newest first", async () => {
      const caller = await startSession();
      const other = await startSession();
      const base = Date.now();

      for (let index = 0; index < 3; index += 1) {
        await createAuditEvent(
          caller.userId,
          new Date(base - index * 1_000),
          `caller.event.${index}`,
        );
      }
      await createAuditEvent(other.userId, new Date(base), 'other.event');

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/activity',
        headers: { cookie: caller.cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        events: Array<{ id: string; action: string; createdAt: string }>;
        nextCursor: string | null;
      };
      expect(body.events.map((event) => event.action)).toEqual([
        'caller.event.0',
        'caller.event.1',
        'caller.event.2',
      ]);
      expect(body.nextCursor).toBeNull();
    });

    it('defaults to 20 and validates the limit', async () => {
      const caller = await startSession();
      const base = Date.now();
      for (let index = 0; index < 25; index += 1) {
        await createAuditEvent(caller.userId, new Date(base - index * 1_000));
      }

      const defaulted = await app.inject({
        method: 'GET',
        url: '/api/account/activity',
        headers: { cookie: caller.cookie },
      });
      expect(defaulted.statusCode).toBe(200);
      expect((defaulted.json() as { events: unknown[] }).events).toHaveLength(
        ACTIVITY_DEFAULT_LIMIT,
      );

      for (const limit of ['51', '0', 'abc']) {
        const rejected = await app.inject({
          method: 'GET',
          url: `/api/account/activity?limit=${limit}`,
          headers: { cookie: caller.cookie },
        });
        expect(rejected.statusCode).toBe(400);
      }

      const max = await app.inject({
        method: 'GET',
        url: '/api/account/activity?limit=50',
        headers: { cookie: caller.cookie },
      });
      expect(max.statusCode).toBe(200);
      expect((max.json() as { events: unknown[] }).events).toHaveLength(25);
      expect((max.json() as { nextCursor: string | null }).nextCursor).toBeNull();
    });

    it('paginates with the cursor over strictly older rows without repeats', async () => {
      const caller = await startSession();
      const base = Date.now();
      for (let index = 0; index < 25; index += 1) {
        await createAuditEvent(caller.userId, new Date(base - index * 1_000));
      }

      const first = await app.inject({
        method: 'GET',
        url: '/api/account/activity?limit=20',
        headers: { cookie: caller.cookie },
      });
      const firstBody = first.json() as {
        events: Array<{ id: string; createdAt: string }>;
        nextCursor: string | null;
      };
      expect(firstBody.events).toHaveLength(20);
      expect(firstBody.nextCursor).toBe(firstBody.events[19]?.createdAt);

      const second = await app.inject({
        method: 'GET',
        url: `/api/account/activity?limit=20&cursor=${encodeURIComponent(
          firstBody.nextCursor as string,
        )}`,
        headers: { cookie: caller.cookie },
      });
      const secondBody = second.json() as {
        events: Array<{ id: string; createdAt: string }>;
        nextCursor: string | null;
      };
      expect(secondBody.events).toHaveLength(5);
      expect(secondBody.nextCursor).toBeNull();

      const seen = new Set(firstBody.events.map((event) => event.id));
      for (const event of secondBody.events) {
        expect(seen.has(event.id)).toBe(false);
        expect(Date.parse(event.createdAt)).toBeLessThan(
          Date.parse(firstBody.nextCursor as string),
        );
      }
      expect(
        new Set([...firstBody.events, ...secondBody.events].map((event) => event.id)).size,
      ).toBe(25);
    });

    it('rejects a non-ISO cursor', async () => {
      const caller = await startSession();

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/activity?cursor=not-a-date',
        headers: { cookie: caller.cookie },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
