// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccountService } from '../accountService.ts';
import { buildDocumentApiApp, TRASH_RETENTION_DAYS } from '../app.ts';
import { hashPassphrase } from '../auth.ts';
import type { OAuthProvider } from '../auth/providers.ts';
import { DiskBlobStorage } from '../blobStorage.ts';
import { createDocumentStore, type FileDocumentStore } from '../documentStore.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PostgresDocumentStore } from '../postgresDocumentStore.ts';
import { SessionService, SESSION_COOKIE_NAME } from '../session.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const PASSPHRASE = 'correct horse battery staple';
const BASE_URL = 'http://localhost:5136';

const TRASH_URL = '/api/documents/trash';

describe('trash routes (self-host)', () => {
  let root: string;
  let store: FileDocumentStore;
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'docx-trash-routes-'));
    store = createDocumentStore({ rootDirectory: root });
    app = buildDocumentApiApp({
      store,
      authPassphraseHash: hashPassphrase(PASSPHRASE),
      rateLimitMaxRequests: false,
    });
    await app.ready();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ passphrase: PASSPHRASE }),
    });
    cookie = login.headers['set-cookie'] as string;
  });

  afterAll(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  async function backdateDeletion(documentId: string, deletedAt: Date) {
    const indexPath = join(root, 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf-8')) as {
      documents: Array<{ id: string; deletedAt: string | null }>;
    };
    const document = index.documents.find((entry) => entry.id === documentId);
    if (!document) throw new Error(`Document ${documentId} is not in the index.`);
    document.deletedAt = deletedAt.toISOString();
    await writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  it('requires a session for every trash route', async () => {
    const requests = [
      { method: 'GET' as const, url: TRASH_URL },
      { method: 'POST' as const, url: `/api/documents/${MISSING_ID}/restore` },
      { method: 'DELETE' as const, url: `/api/documents/${MISSING_ID}/purge` },
    ];

    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
    }
  });

  it('soft-deletes, lists trash, restores, then purges', async () => {
    const created = await store.saveNewDocument({
      name: 'Route.docx',
      buffer: Uint8Array.from([1]),
    });

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${created.id}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);

    const hidden = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie },
    });
    expect(hidden.json()).toEqual([]);

    const trash = await app.inject({ method: 'GET', url: TRASH_URL, headers: { cookie } });
    expect(trash.json()).toMatchObject([{ id: created.id, name: 'Route.docx' }]);

    const restored = await app.inject({
      method: 'POST',
      url: `/api/documents/${created.id}/restore`,
      headers: { cookie },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: created.id, name: 'Route.docx' });

    const relisted = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie },
    });
    expect((relisted.json() as Array<{ id: string }>).map((document) => document.id)).toEqual([
      created.id,
    ]);

    await app.inject({
      method: 'DELETE',
      url: `/api/documents/${created.id}`,
      headers: { cookie },
    });
    const purged = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${created.id}/purge`,
      headers: { cookie },
    });
    expect(purged.statusCode).toBe(204);

    const trashAfterPurge = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie },
    });
    expect(trashAfterPurge.json()).toEqual([]);

    const readAfterPurge = await app.inject({
      method: 'GET',
      url: `/api/documents/${created.id}/content`,
      headers: { cookie },
    });
    expect(readAfterPurge.statusCode).toBe(404);
  });

  it('treats restore and purge of an unknown id as not found', async () => {
    const restore = await app.inject({
      method: 'POST',
      url: `/api/documents/${MISSING_ID}/restore`,
      headers: { cookie },
    });
    expect(restore.statusCode).toBe(404);

    const purge = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${MISSING_ID}/purge`,
      headers: { cookie },
    });
    expect(purge.statusCode).toBe(404);
  });

  it('refuses to purge a live document', async () => {
    const created = await store.saveNewDocument({
      name: 'Live.docx',
      buffer: Uint8Array.from([2]),
    });

    const purged = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${created.id}/purge`,
      headers: { cookie },
    });
    expect(purged.statusCode).toBe(404);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie },
    });
    expect((listed.json() as Array<{ id: string }>).map((document) => document.id)).toEqual([
      created.id,
    ]);
  });

  it('sweeps expired trash out of the caller’s view', async () => {
    const expired = await store.saveNewDocument({
      name: 'Expired.docx',
      buffer: Uint8Array.from([1]),
    });
    const recent = await store.saveNewDocument({
      name: 'Recent.docx',
      buffer: Uint8Array.from([2]),
    });
    await store.deleteDocument(expired.id);
    await store.deleteDocument(recent.id);
    await backdateDeletion(
      expired.id,
      new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000),
    );

    const trash = await app.inject({ method: 'GET', url: TRASH_URL, headers: { cookie } });

    expect(
      (trash.json() as Array<{ id: string }>).map((document) => document.id),
    ).toEqual([recent.id]);
    await expect(store.readDocument(expired.id)).rejects.toThrow(/not found/i);
  });
});

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);

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
describe.skipIf(!hasDatabase)('trash route ownership', () => {
  let prisma: PrismaClient;
  let store: PostgresDocumentStore;
  let app: FastifyInstance;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the trash ownership tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    store = new PostgresDocumentStore({
      prisma,
      blobs: new DiskBlobStorage({ rootDir: await mkdtemp(join(tmpdir(), 'docx-trash-blobs-')) }),
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

  async function saveFor(userId: string, name: string) {
    return store.forOwner(userId).saveNewDocument({
      name,
      buffer: Uint8Array.from([1, 2, 3]),
    });
  }

  it('requires a session for every trash route', async () => {
    const requests = [
      { method: 'GET' as const, url: TRASH_URL },
      { method: 'POST' as const, url: `/api/documents/${MISSING_ID}/restore` },
      { method: 'DELETE' as const, url: `/api/documents/${MISSING_ID}/purge` },
    ];

    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
    }
  });

  it('shows only the caller’s own trash', async () => {
    const alice = await guestSession();
    const bob = await guestSession();
    const aliceDoc = await saveFor(alice.userId, 'Alice.docx');
    await saveFor(bob.userId, 'Bob.docx');

    await store.forOwner(alice.userId).deleteDocument(aliceDoc.id);

    const aliceTrash = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie: alice.cookie },
    });
    expect(
      (aliceTrash.json() as Array<{ id: string }>).map((document) => document.id),
    ).toEqual([aliceDoc.id]);

    const bobTrash = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie: bob.cookie },
    });
    expect(bobTrash.json()).toEqual([]);
  });

  it('restores a trashed document back into the caller’s list', async () => {
    const alice = await guestSession();
    const created = await saveFor(alice.userId, 'Recover.docx');
    await store.forOwner(alice.userId).deleteDocument(created.id);

    const restored = await app.inject({
      method: 'POST',
      url: `/api/documents/${created.id}/restore`,
      headers: { cookie: alice.cookie },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: created.id, name: 'Recover.docx' });

    const listed = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie: alice.cookie },
    });
    expect((listed.json() as Array<{ id: string }>).map((document) => document.id)).toEqual([
      created.id,
    ]);
  });

  it('does not let one owner restore or purge another owner’s document', async () => {
    const alice = await guestSession();
    const bob = await guestSession();
    const aliceDoc = await saveFor(alice.userId, 'Private.docx');
    await store.forOwner(alice.userId).deleteDocument(aliceDoc.id);

    const crossRestore = await app.inject({
      method: 'POST',
      url: `/api/documents/${aliceDoc.id}/restore`,
      headers: { cookie: bob.cookie },
    });
    expect(crossRestore.statusCode).toBe(404);

    const crossPurge = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${aliceDoc.id}/purge`,
      headers: { cookie: bob.cookie },
    });
    expect(crossPurge.statusCode).toBe(404);

    const aliceTrash = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie: alice.cookie },
    });
    expect((aliceTrash.json() as Array<{ id: string }>).map((document) => document.id)).toEqual([
      aliceDoc.id,
    ]);
  });

  it('purges a trashed document beyond recovery', async () => {
    const alice = await guestSession();
    const created = await saveFor(alice.userId, 'Gone.docx');
    await store.forOwner(alice.userId).deleteDocument(created.id);

    const purged = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${created.id}/purge`,
      headers: { cookie: alice.cookie },
    });
    expect(purged.statusCode).toBe(204);

    const trash = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie: alice.cookie },
    });
    expect(trash.json()).toEqual([]);

    const restore = await app.inject({
      method: 'POST',
      url: `/api/documents/${created.id}/restore`,
      headers: { cookie: alice.cookie },
    });
    expect(restore.statusCode).toBe(404);
  });

  it('refuses to purge a live document', async () => {
    const alice = await guestSession();
    const created = await saveFor(alice.userId, 'Live.docx');

    const purged = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${created.id}/purge`,
      headers: { cookie: alice.cookie },
    });
    expect(purged.statusCode).toBe(404);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie: alice.cookie },
    });
    expect((listed.json() as Array<{ id: string }>).map((document) => document.id)).toEqual([
      created.id,
    ]);
  });

  it('sweeps expired trash only for the caller’s own documents', async () => {
    const alice = await guestSession();
    const bob = await guestSession();
    const aliceExpired = await saveFor(alice.userId, 'Alice Expired.docx');
    const aliceRecent = await saveFor(alice.userId, 'Alice Recent.docx');
    const bobExpired = await saveFor(bob.userId, 'Bob Expired.docx');

    await store.forOwner(alice.userId).deleteDocument(aliceExpired.id);
    await store.forOwner(alice.userId).deleteDocument(aliceRecent.id);
    await store.forOwner(bob.userId).deleteDocument(bobExpired.id);

    const expiredAt = new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    await prisma.document.update({
      where: { id: aliceExpired.id },
      data: { deletedAt: expiredAt },
    });
    await prisma.document.update({
      where: { id: bobExpired.id },
      data: { deletedAt: expiredAt },
    });

    const aliceTrash = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie: alice.cookie },
    });
    expect((aliceTrash.json() as Array<{ id: string }>).map((document) => document.id)).toEqual([
      aliceRecent.id,
    ]);

    const bobRow = await prisma.document.findUnique({ where: { id: bobExpired.id } });
    expect(bobRow).not.toBeNull();

    const bobTrash = await app.inject({
      method: 'GET',
      url: TRASH_URL,
      headers: { cookie: bob.cookie },
    });
    expect(bobTrash.json()).toEqual([]);
  });
});
