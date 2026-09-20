// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountService } from '../accountService.ts';
import { buildDocumentApiApp } from '../app.ts';
import type { OAuthProvider } from '../auth/providers.ts';
import { AuditService } from '../audit.ts';
import { createDocumentStore } from '../documentStore.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { SessionService } from '../session.ts';
import { WorkspaceService } from '../workspace.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const BASE_URL = 'http://localhost:5136';
const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events", "document_shares", "document_comments", "api_tokens", "notifications", "ai_preferences", "ai_usage" cascade';

const provider: OAuthProvider = {
  id: 'google',
  label: 'Google',
  async createAuthorization() {
    throw new Error('not used');
  },
  async completeAuthorization() {
    throw new Error('not used');
  },
};

function readCookie(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(';')[0];
}

describe.skipIf(!databaseUrl)('workspace routes (integration)', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for workspace routes.');
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const accounts = new AccountService({ prisma });
    app = buildDocumentApiApp({
      store: createDocumentStore({ rootDirectory: await mkdtemp(join(tmpdir(), 'docx-workspace-routes-')) }),
      staticDir: '',
      accounts: {
        accounts,
        sessions: new SessionService({ prisma, ttlMs: 60_000 }),
        providers: [provider],
        baseUrl: BASE_URL,
        audit: new AuditService({ prisma }),
      },
      workspace: new WorkspaceService({ prisma }),
      ai: { enabled: true, apiKey: 'test-key', provider: 'test', baseUrl: 'https://ai.example/v1', model: 'test-model', maxRequestsPerHour: 10 },
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

  async function session() {
    const response = await app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(response.statusCode).toBe(200);
    return {
      cookie: readCookie(response.headers['set-cookie'])!,
      userId: (response.json() as { user: { id: string } }).user.id,
    };
  }

  it('covers workspace CRUD, public token access, notifications, and streaming chat', async () => {
    const { cookie, userId } = await session();
    const now = new Date();
    const documentId = randomUUID();
    await prisma.document.create({
      data: { id: documentId, ownerId: userId, name: 'Shared.docx', sizeInBytes: 1, versionCount: 1, revision: 1, createdAt: now, updatedAt: now, searchText: 'shared text' },
    });

    expect((await app.inject({ method: 'GET', url: '/api/workspace/documents?q=shared', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/workspace/usage', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `/api/workspace/documents/${documentId}`, headers: { cookie }, payload: { folder: 'Work', tags: ['one'], isStarred: true } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/workspace/documents/bulk', headers: { cookie }, payload: { documentIds: [documentId], folder: 'Archive' } })).json()).toEqual({ updated: 1 });

    const share = await app.inject({ method: 'POST', url: `/api/workspace/documents/${documentId}/shares`, headers: { cookie }, payload: { email: 'reviewer@example.com', role: 'viewer' } });
    expect(share.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/workspace/documents/${documentId}/shares`, headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/workspace/documents/${documentId}/shares/${share.json().id}`, headers: { cookie } })).statusCode).toBe(204);

    const comment = await app.inject({ method: 'POST', url: `/api/workspace/documents/${documentId}/comments`, headers: { cookie }, payload: { body: 'Looks good', paraId: 'p1' } });
    expect(comment.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: `/api/workspace/documents/${documentId}/comments`, headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `/api/workspace/comments/${comment.json().id}`, headers: { cookie }, payload: { resolved: true } })).statusCode).toBe(200);

    const token = await app.inject({ method: 'POST', url: '/api/account/tokens', headers: { cookie }, payload: { name: 'integration' } });
    expect(token.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/api/public/documents', headers: { authorization: `Bearer ${token.json().token}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/account/tokens', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/account/tokens/${token.json().id}`, headers: { cookie } })).statusCode).toBe(204);

    expect((await app.inject({ method: 'GET', url: '/api/workspace/notifications', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/workspace/notifications/read', headers: { cookie }, payload: {} })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/ai/settings', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: '/api/ai/settings', headers: { cookie }, payload: { model: 'test-model', enabled: true } })).statusCode).toBe(200);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n', { status: 200 }));
    try {
      const chat = await app.inject({ method: 'POST', url: '/api/ai/chat', headers: { cookie }, payload: { messages: [{ role: 'user', content: 'hello' }] } });
      expect(chat.statusCode).toBe(200);
      expect(chat.body).toContain('hello');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('rejects unauthenticated and malformed workspace requests and keeps the AI endpoint operator-owned', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/workspace/documents' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/public/documents', headers: { authorization: 'Bearer invalid' } })).statusCode).toBe(401);

    const { cookie, userId } = await session();
    const documentId = randomUUID();
    const now = new Date();
    await prisma.document.create({
      data: { id: documentId, ownerId: userId, name: 'Validation.docx', sizeInBytes: 1, versionCount: 1, revision: 1, createdAt: now, updatedAt: now },
    });
    expect((await app.inject({ method: 'PATCH', url: `/api/workspace/documents/${documentId}`, headers: { cookie }, payload: { tags: 'not-an-array' } })).statusCode).toBe(400);

    const settings = await app.inject({ method: 'PATCH', url: '/api/ai/settings', headers: { cookie }, payload: { model: 'safe-model', baseUrl: 'https://attacker.example/v1' } });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().baseUrl).toBe('https://ai.example/v1');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('provider down', { status: 503 }));
    try {
      const chat = await app.inject({ method: 'POST', url: '/api/ai/chat', headers: { cookie }, payload: { messages: [{ role: 'user', content: 'hello' }] } });
      expect(chat.statusCode).toBe(502);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
