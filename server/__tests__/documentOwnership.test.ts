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
import { DiskBlobStorage } from '../blobStorage.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PostgresDocumentStore } from '../postgresDocumentStore.ts';
import { SessionService, SESSION_COOKIE_NAME } from '../session.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);
const BASE_URL = 'http://localhost:5136';

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

const unusedProvider: OAuthProvider = {
  id: 'github',
  label: 'Stub',
  createAuthorization: async () => ({ url: 'https://stub.example', state: 's' }),
  completeAuthorization: async () => ({
    provider: 'github',
    providerAccountId: 'x',
    email: null,
    emailVerified: false,
    name: null,
    avatarUrl: null,
  }),
};

function readCookie(setCookie: string | string[] | undefined, name: string) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = headers.find((header) => header.startsWith(`${name}=`));
  return match ? match.split(';')[0] : undefined;
}

// Skipped unless TEST_DATABASE_URL is set; expects migrations applied.
describe.skipIf(!hasDatabase)('document ownership', () => {
  let prisma: PrismaClient;
  let store: PostgresDocumentStore;
  let app: FastifyInstance;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the ownership tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    store = new PostgresDocumentStore({
      prisma,
      blobs: new DiskBlobStorage({ rootDir: await mkdtemp(join(tmpdir(), 'docx-ownership-')) }),
    });

    app = buildDocumentApiApp({
      store,
      staticDir: '',
      accounts: {
        accounts: new AccountService({ prisma }),
        sessions: new SessionService({ prisma, ttlMs: 60_000 }),
        providers: [unusedProvider],
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

  async function guestSession() {
    const response = await app.inject({ method: 'GET', url: '/api/auth/session' });
    return {
      cookie: readCookie(response.headers['set-cookie'], SESSION_COOKIE_NAME) as string,
      userId: (response.json() as { user: { id: string } }).user.id,
    };
  }

  it('requires a session for document access', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/documents' });
    expect(response.statusCode).toBe(401);
  });

  it('isolates each owner’s documents', async () => {
    const alice = await guestSession();
    const bob = await guestSession();

    const aliceDoc = await store
      .forOwner(alice.userId)
      .saveNewDocument({ name: 'Alice.docx', buffer: Uint8Array.from([1, 2, 3]) });
    await store
      .forOwner(bob.userId)
      .saveNewDocument({ name: 'Bob.docx', buffer: Uint8Array.from([4, 5, 6]) });

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie: alice.cookie },
    });
    expect((aliceList.json() as Array<{ name: string }>).map((document) => document.name)).toEqual([
      'Alice.docx',
    ]);

    const bobList = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie: bob.cookie },
    });
    expect((bobList.json() as Array<{ name: string }>).map((document) => document.name)).toEqual([
      'Bob.docx',
    ]);

    // Cross-owner access is a 404, not a leak.
    const crossRead = await app.inject({
      method: 'GET',
      url: `/api/documents/${aliceDoc.id}/content`,
      headers: { cookie: bob.cookie },
    });
    expect(crossRead.statusCode).toBe(404);

    const crossDelete = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${aliceDoc.id}`,
      headers: { cookie: bob.cookie },
    });
    expect(crossDelete.statusCode).toBe(404);
  });
});
