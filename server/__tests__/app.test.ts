// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string) => [{ address: hostname === '127.0.0.1' ? hostname : '93.184.216.34', family: 4 }]),
}));

import { API_VERSION, buildDocumentApiApp } from '../app.ts';
import { hashPassphrase } from '../auth.ts';
import { createFileAuthStateStore } from '../authStore.ts';
import { createDocumentStore } from '../documentStore.ts';

async function docxPayload(bytes: number[]) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', '<document/>');
  zip.file('word/test.bin', Buffer.from(bytes));
  return Buffer.from(await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }));
}

describe('buildDocumentApiApp', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  async function createApp() {
    const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-api-'));
    tempDirectories.push(storageDirectory);

    const store = createDocumentStore({ rootDirectory: storageDirectory });
    const app = buildDocumentApiApp({ store });
    await app.ready();
    return app;
  }

  describe('passphrase auth', () => {
    async function createAuthApp() {
      const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-auth-'));
      tempDirectories.push(storageDirectory);

      const store = createDocumentStore({ rootDirectory: storageDirectory });
      const app = buildDocumentApiApp({
        store,
        authPassphraseHash: hashPassphrase('correct horse battery staple'),
        rateLimitMaxRequests: false,
      });
      await app.ready();
      return app;
    }

    function loginRequest(app: Awaited<ReturnType<typeof createAuthApp>>, passphrase: string) {
      return app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ passphrase }),
      });
    }

    it('rejects protected routes without a session', async () => {
      const app = await createAuthApp();

      try {
        const response = await app.inject({ method: 'GET', url: '/api/documents' });
        expect(response.statusCode).toBe(401);
        expect(response.json<{ message: string }>().message).toBe('Authentication required.');
      } finally {
        await app.close();
      }
    });

    it('logs in with the correct passphrase and unlocks protected routes', async () => {
      const app = await createAuthApp();

      try {
        const login = await loginRequest(app, 'correct horse battery staple');
        expect(login.statusCode).toBe(204);

        const cookie = login.headers['set-cookie'];
        expect(String(cookie)).toContain('HttpOnly');
        expect(String(cookie)).toContain('SameSite=Strict');

        const documents = await app.inject({
          method: 'GET',
          url: '/api/documents',
          headers: { cookie },
        });
        expect(documents.statusCode).toBe(200);
        expect(documents.json<unknown[]>()).toEqual([]);

        const session = await app.inject({
          method: 'GET',
          url: '/api/auth/session',
          headers: { cookie },
        });
        expect(session.statusCode).toBe(200);
        expect(
          session.json<{ authRequired: boolean; needsSetup: boolean; authenticated: boolean }>(),
        ).toEqual({
          authRequired: true,
          needsSetup: false,
          authenticated: true,
        });
      } finally {
        await app.close();
      }
    });

    it('rejects a wrong passphrase and reports the session state', async () => {
      const app = await createAuthApp();

      try {
        const login = await loginRequest(app, 'wrong passphrase');
        expect(login.statusCode).toBe(401);

        const session = await app.inject({ method: 'GET', url: '/api/auth/session' });
        expect(
          session.json<{ authRequired: boolean; needsSetup: boolean; authenticated: boolean }>(),
        ).toEqual({
          authRequired: true,
          needsSetup: false,
          authenticated: false,
        });
      } finally {
        await app.close();
      }
    });

    it('clears the session cookie on logout', async () => {
      const app = await createAuthApp();

      try {
        const login = await loginRequest(app, 'correct horse battery staple');
        const cookie = login.headers['set-cookie'];

        const logout = await app.inject({
          method: 'POST',
          url: '/api/auth/logout',
          headers: { cookie },
        });
        expect(logout.statusCode).toBe(204);

        const clearCookie = String(logout.headers['set-cookie']);
        expect(clearCookie).toContain('Max-Age=0');

        // A client that honours the cleared cookie (any real browser) is
        // locked out; the stateless token itself is not revocable server-side.
        const documents = await app.inject({ method: 'GET', url: '/api/documents' });
        expect(documents.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    it('rejects tampered session tokens', async () => {
      const app = await createAuthApp();

      try {
        const login = await loginRequest(app, 'correct horse battery staple');
        const cookie = String(login.headers['set-cookie']).split(';')[0];
        const [name, token] = cookie.split('=');
        const tampered = `${name}=${token.split('.')[0]}.deadbeef`;

        const documents = await app.inject({
          method: 'GET',
          url: '/api/documents',
          headers: { cookie: tampered },
        });
        expect(documents.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    it('rate limits repeated failed logins', async () => {
      const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-auth-rl-'));
      tempDirectories.push(storageDirectory);

      const store = createDocumentStore({ rootDirectory: storageDirectory });
      // The rate-limit plugin must be registered for the route-level login
      // limit to engage, so this app keeps the (generous) global default.
      const app = buildDocumentApiApp({
        store,
        authPassphraseHash: hashPassphrase('correct horse battery staple'),
      });
      await app.ready();

      try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const login = await loginRequest(app, 'wrong passphrase');
          expect(login.statusCode).toBe(401);
        }

        const blocked = await loginRequest(app, 'correct horse battery staple');
        expect(blocked.statusCode).toBe(429);
      } finally {
        await app.close();
      }
    });
  });

  describe('instance claiming (AUTH_MODE=claim)', () => {
    function loginRequest(app: FastifyInstance, passphrase: string) {
      return app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ passphrase }),
      });
    }

    function createClaimApp() {
      const storageDirectory = path.join(tmpdir(), `docx-editor-claim-${randomUUID()}`);
      tempDirectories.push(storageDirectory);

      const store = createDocumentStore({ rootDirectory: storageDirectory });
      const authStateStore = createFileAuthStateStore({
        filePath: path.join(storageDirectory, '..', `claim-${randomUUID()}.json`),
      });
      const app = buildDocumentApiApp({
        store,
        authStateStore,
        allowAuthClaim: true,
        rateLimitMaxRequests: false,
      });
      return { app, authStateStore };
    }

    it('reports setup pending before claiming and locks protected routes', async () => {
      const { app } = createClaimApp();
      await app.ready();

      try {
        const session = await app.inject({ method: 'GET', url: '/api/auth/session' });
        expect(session.json<{ authRequired: boolean; needsSetup: boolean }>().needsSetup).toBe(
          true,
        );

        const documents = await app.inject({ method: 'GET', url: '/api/documents' });
        expect(documents.statusCode).toBe(401);

        const login = await loginRequest(app, 'anything');
        expect(login.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });

    it('claims the instance, signs in, and unlocks protected routes', async () => {
      const { app } = createClaimApp();
      await app.ready();

      try {
        const setup = await app.inject({
          method: 'POST',
          url: '/api/auth/setup',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ passphrase: 'my-long-passphrase' }),
        });
        expect(setup.statusCode).toBe(204);

        const cookie = setup.headers['set-cookie'];
        expect(String(cookie)).toContain('HttpOnly');

        const session = await app.inject({
          method: 'GET',
          url: '/api/auth/session',
          headers: { cookie },
        });
        expect(session.json<{ authRequired: boolean; needsSetup: boolean; authenticated: boolean }>()).toEqual({
          authRequired: true,
          needsSetup: false,
          authenticated: true,
        });

        const documents = await app.inject({
          method: 'GET',
          url: '/api/documents',
          headers: { cookie },
        });
        expect(documents.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });

    it('rejects weak passphrases and refuses double claiming', async () => {
      const { app } = createClaimApp();
      await app.ready();

      try {
        const weak = await app.inject({
          method: 'POST',
          url: '/api/auth/setup',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ passphrase: 'short' }),
        });
        expect(weak.statusCode).toBe(400);

        const setup = await app.inject({
          method: 'POST',
          url: '/api/auth/setup',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ passphrase: 'my-long-passphrase' }),
        });
        expect(setup.statusCode).toBe(204);

        const secondClaim = await app.inject({
          method: 'POST',
          url: '/api/auth/setup',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ passphrase: 'other-long-passphrase' }),
        });
        expect(secondClaim.statusCode).toBe(409);

        const session = await app.inject({ method: 'GET', url: '/api/auth/session' });
        expect(session.json<{ needsSetup: boolean }>().needsSetup).toBe(false);
      } finally {
        await app.close();
      }
    });

    it('does not expose the setup route when claiming is disabled', async () => {
      const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-noclaim-'));
      tempDirectories.push(storageDirectory);

      const store = createDocumentStore({ rootDirectory: storageDirectory });
      const app = buildDocumentApiApp({
        store,
        authPassphraseHash: hashPassphrase('correct horse battery staple'),
      });
      await app.ready();

      try {
        const setup = await app.inject({
          method: 'POST',
          url: '/api/auth/setup',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ passphrase: 'my-long-passphrase' }),
        });
        expect(setup.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it('creates documents, appends versions, and serves latest and historical content', async () => {
    const app = await createApp();

    try {
      const firstPayload = await docxPayload([1, 2, 3]);
      const secondPayload = await docxPayload([9, 8, 7, 6]);
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Proposal.docx',
        },
        payload: firstPayload,
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json<{
        id: string;
        name: string;
        sizeInBytes: number;
        versionCount: number;
        lastOpenedAt: string | null;
        revision: number;
      }>();
      expect(created.name).toBe('Proposal.docx');
      expect(created.sizeInBytes).toBe(firstPayload.byteLength);
      expect(created.versionCount).toBe(1);
      expect(created.revision).toBe(1);
      expect(created.lastOpenedAt).toBeNull();

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/documents',
      });
      expect(listResponse.statusCode).toBe(200);
      const documents = listResponse.json<Array<{ id: string; name: string; versionCount: number }>>();
      expect(documents).toHaveLength(1);
      expect(documents[0]?.id).toBe(created.id);
      expect(documents[0]?.versionCount).toBe(1);

      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/documents/${created.id}`,
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Proposal Final.docx',
        },
        payload: secondPayload,
      });

      expect(updateResponse.statusCode).toBe(200);
      const updated = updateResponse.json<{ name: string; sizeInBytes: number; versionCount: number }>();
      expect(updated.name).toBe('Proposal Final.docx');
      expect(updated.sizeInBytes).toBe(secondPayload.byteLength);
      expect(updated.versionCount).toBe(2);

      const versionsResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${created.id}/versions`,
      });
      expect(versionsResponse.statusCode).toBe(200);
      const versions = versionsResponse.json<
        Array<{ id: string; documentId: string; name: string; sizeInBytes: number }>
      >();
      expect(versions).toHaveLength(2);
      expect(versions[0]?.name).toBe('Proposal Final.docx');
      expect(versions[1]?.name).toBe('Proposal.docx');

      const contentResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${created.id}/content?markOpened=true`,
      });
      expect(contentResponse.statusCode).toBe(200);
      expect(Array.from(contentResponse.rawPayload)).toEqual(Array.from(secondPayload));

      const contentListResponse = await app.inject({
        method: 'GET',
        url: '/api/documents',
      });
      expect(contentListResponse.statusCode).toBe(200);
      const contentList = contentListResponse.json<Array<{ lastOpenedAt: string | null }>>();
      expect(contentList[0]?.lastOpenedAt).not.toBeNull();

      const historicalContentResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${created.id}/versions/${versions[1]!.id}/content`,
      });
      expect(historicalContentResponse.statusCode).toBe(200);
      expect(Array.from(historicalContentResponse.rawPayload)).toEqual(Array.from(firstPayload));

      const missingResponse = await app.inject({
        method: 'GET',
        url: '/api/documents/missing/versions',
      });
      expect(missingResponse.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('round-trips Unicode document names through encoded headers', async () => {
    const app = await createApp();

    try {
      const documentName = 'Báo cáo Tabularis.docx';
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': encodeURIComponent(documentName),
        },
        payload: await docxPayload([1, 2, 3]),
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json<{
        id: string;
        name: string;
      }>();
      expect(created.name).toBe(documentName);

      const contentResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${created.id}/content`,
      });
      expect(contentResponse.statusCode).toBe(200);
      expect(contentResponse.headers['content-disposition']).toContain("filename*=UTF-8''");
    } finally {
      await app.close();
    }
  });

  it('renames and deletes saved documents over HTTP', async () => {
    const app = await createApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Proposal.docx',
        },
        payload: await docxPayload([1, 2, 3]),
      });
      const created = createResponse.json<{ id: string }>();

      const renameResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          name: 'Proposal Renamed.docx',
        },
      });
      expect(renameResponse.statusCode).toBe(200);
      const renamed = renameResponse.json<{ name: string }>();
      expect(renamed.name).toBe('Proposal Renamed.docx');

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${created.id}`,
      });
      expect(deleteResponse.statusCode).toBe(204);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/documents',
      });
      expect(listResponse.json()).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('returns 400 when the rename payload is invalid', async () => {
    const app = await createApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Proposal.docx',
        },
        payload: await docxPayload([1, 2, 3]),
      });
      const created = createResponse.json<{ id: string }>();

      const renameResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          name: '',
        },
      });

      expect(renameResponse.statusCode).toBe(400);
      expect(renameResponse.json()).toEqual({
        message: 'Request validation failed.',
      });
    } finally {
      await app.close();
    }
  });

  it('imports a bounded DOCX response and rejects unsafe upstream responses', async () => {
    const app = await createApp();
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    try {
      fetchMock.mockResolvedValueOnce(
        new Response(await docxPayload([1, 2, 3]), {
          headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        }),
      );

      const imported = await app.inject({
        method: 'POST',
        url: '/api/documents/import-url',
        headers: { 'content-type': 'application/json' },
        payload: { url: 'https://public.example/template.docx' },
      });

      expect(imported.statusCode).toBe(201);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
      );

      fetchMock.mockResolvedValueOnce(
        new Response('<html>not a document</html>', {
          headers: { 'content-type': 'text/html' },
        }),
      );
      const html = await app.inject({
        method: 'POST',
        url: '/api/documents/import-url',
        headers: { 'content-type': 'application/json' },
        payload: { url: 'https://public.example/template.docx' },
      });
      expect(html.statusCode).toBe(400);

      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          headers: { 'content-type': 'application/octet-stream', 'content-length': String(50 * 1024 * 1024 + 1) },
        }),
      );
      const oversized = await app.inject({
        method: 'POST',
        url: '/api/documents/import-url',
        headers: { 'content-type': 'application/json' },
        payload: { url: 'https://public.example/template.docx' },
      });
      expect(oversized.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('rejects redirects to private addresses and upstream timeouts', async () => {
    const app = await createApp();
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    try {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/internal.docx' } }),
      );
      const privateRedirect = await app.inject({
        method: 'POST',
        url: '/api/documents/import-url',
        headers: { 'content-type': 'application/json' },
        payload: { url: 'https://public.example/template.docx' },
      });
      expect(privateRedirect.statusCode).toBe(400);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fetchMock.mockRejectedValueOnce(new Error('upstream timeout'));
      const timeout = await app.inject({
        method: 'POST',
        url: '/api/documents/import-url',
        headers: { 'content-type': 'application/json' },
        payload: { url: 'https://public.example/template.docx' },
      });
      expect(timeout.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('exposes API health metadata for launcher compatibility checks', async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        apiVersion: API_VERSION,
      });
    } finally {
      await app.close();
    }
  });
  it('adds basic response hardening headers and a request id', async () => {
    const app = await createApp();

    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-request-id']).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it('exposes readiness separately from liveness', async () => {
    const app = await createApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ready', apiVersion: API_VERSION });
    } finally {
      await app.close();
    }
  });

  it('uses the bounded readiness probe instead of scanning document blobs', async () => {
    const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-ready-'));
    tempDirectories.push(storageDirectory);
    const store = createDocumentStore({ rootDirectory: storageDirectory });
    const checkReady = vi.spyOn(store, 'checkReady');
    const verifyIntegrity = vi.spyOn(store, 'verifyIntegrity');
    const app = buildDocumentApiApp({ store });
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(response.statusCode).toBe(200);
      expect(checkReady).toHaveBeenCalledOnce();
      expect(verifyIntegrity).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('rejects empty, non-DOCX, and overlong uploads', async () => {
    const app = await createApp();

    try {
      const invalidPayloads = [Buffer.alloc(0), Buffer.from([1, 2, 3, 4])];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/documents',
          headers: {
            'content-type': 'application/octet-stream',
            'x-document-name': 'Invalid.docx',
          },
          payload,
        });
        expect(response.statusCode).toBe(400);
      }

      const longNameResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'a'.repeat(256),
        },
        payload: await docxPayload([1]),
      });
      expect(longNameResponse.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('rejects stale document updates with a conflict', async () => {
    const app = await createApp();
    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'content-type': 'application/octet-stream', 'x-document-name': 'Conflict.docx' },
        payload: await docxPayload([1]),
      });
      const created = createResponse.json<{ id: string }>();

      const firstUpdate = await app.inject({
        method: 'PUT',
        url: `/api/documents/${created.id}`,
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Conflict.docx',
          'if-match': '"1"',
        },
        payload: await docxPayload([2]),
      });
      expect(firstUpdate.statusCode).toBe(200);

      const staleUpdate = await app.inject({
        method: 'PUT',
        url: `/api/documents/${created.id}`,
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Conflict.docx',
          'if-match': '"1"',
        },
        payload: await docxPayload([3]),
      });
      expect(staleUpdate.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it('returns CORS headers for allowed origins', async () => {
    const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-cors-'));
    tempDirectories.push(storageDirectory);
    const store = createDocumentStore({ rootDirectory: storageDirectory });
    const app = buildDocumentApiApp({
      store,
      corsOrigin: 'https://editor.example.com',
    });
    await app.ready();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { origin: 'https://editor.example.com' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://editor.example.com');

      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/api/documents',
        headers: {
          origin: 'https://editor.example.com',
          'access-control-request-method': 'POST',
        },
      });
      expect(preflight.statusCode).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe('https://editor.example.com');
    } finally {
      await app.close();
    }
  });

  it('enforces the configured rate limit', async () => {
    const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-rate-'));
    tempDirectories.push(storageDirectory);
    const store = createDocumentStore({ rootDirectory: storageDirectory });
    const app = buildDocumentApiApp({
      store,
      rateLimitMaxRequests: 3,
      rateLimitTimeWindowMs: 60_000,
    });
    await app.ready();

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/documents',
          remoteAddress: '127.0.0.1',
        });
        expect(response.statusCode).toBe(200);
      }

      const limited = await app.inject({
        method: 'GET',
        url: '/api/documents',
        remoteAddress: '127.0.0.1',
      });
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['x-ratelimit-limit']).toBe('3');
    } finally {
      await app.close();
    }
  });

  describe('static serving', () => {
    async function createStaticApp() {
      const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-static-'));
      tempDirectories.push(storageDirectory);

      const staticDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-dist-'));
      tempDirectories.push(staticDirectory);
      const { mkdir, writeFile } = await import('node:fs/promises');
      await writeFile(path.join(staticDirectory, 'index.html'), '<!doctype html><title>DocxCraft</title>');
      await writeFile(path.join(staticDirectory, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      await mkdir(path.join(staticDirectory, 'assets'));
      await writeFile(path.join(staticDirectory, 'assets', 'index-abc123.js'), 'console.log("app");');

      const store = createDocumentStore({ rootDirectory: storageDirectory });
      const app = buildDocumentApiApp({ store, staticDir: staticDirectory });
      await app.ready();
      return app;
    }

    it('serves index.html at the root with no-cache', async () => {
      const app = await createStaticApp();

      try {
        const response = await app.inject({ method: 'GET', url: '/' });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('DocxCraft');
        expect(response.headers['cache-control']).toBe('no-cache');
      } finally {
        await app.close();
      }
    });

    it('serves hashed bundles with an immutable long cache and public files briefly', async () => {
      const app = await createStaticApp();

      try {
        const bundle = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' });
        expect(bundle.statusCode).toBe(200);
        expect(String(bundle.headers['cache-control'])).toContain('max-age=2592000');
        expect(String(bundle.headers['cache-control'])).toContain('immutable');

        const publicFile = await app.inject({ method: 'GET', url: '/favicon.svg' });
        expect(publicFile.statusCode).toBe(200);
        expect(publicFile.headers['content-type']).toContain('image/svg+xml');
        expect(publicFile.headers['cache-control']).toBe('public, max-age=300');
      } finally {
        await app.close();
      }
    });

    it('returns a real 404 for missing bundles instead of the SPA fallback', async () => {
      const app = await createStaticApp();

      try {
        const response = await app.inject({ method: 'GET', url: '/assets/missing-deadbeef.js' });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toContain('application/json');
      } finally {
        await app.close();
      }
    });

    it('falls back to index.html for unknown non-API paths but keeps API 404s', async () => {
      const app = await createStaticApp();

      try {
        const deepLink = await app.inject({ method: 'GET', url: '/some/client/route' });
        expect(deepLink.statusCode).toBe(200);
        expect(deepLink.body).toContain('DocxCraft');

        const apiNotFound = await app.inject({ method: 'GET', url: '/api/unknown' });
        expect(apiNotFound.statusCode).toBe(404);
        expect(apiNotFound.json<{ message: string }>().message).toBe('Route not found.');
      } finally {
        await app.close();
      }
    });

    it('attaches a content security policy to responses', async () => {
      const app = await createStaticApp();

      try {
        const response = await app.inject({ method: 'GET', url: '/' });
        const policy = String(response.headers['content-security-policy']);
        expect(policy).toContain("default-src 'self'");
        expect(policy).toContain("script-src 'self'");
        expect(policy).toContain("frame-ancestors 'none'");
        expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()');
        expect(response.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
        expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
        // Provider avatars are proxied through our own origin, so img-src needs
        // no remote hosts and stays as tight as possible.
        expect(policy).toContain("img-src 'self' data: blob:");
      } finally {
        await app.close();
      }
    });

    it('keeps JSON 404s when static serving is disabled', async () => {
      const storageDirectory = await mkdtemp(path.join(tmpdir(), 'docx-editor-nostatic-'));
      tempDirectories.push(storageDirectory);
      const store = createDocumentStore({ rootDirectory: storageDirectory });
      const app = buildDocumentApiApp({ store, staticDir: '' });
      await app.ready();

      try {
        const response = await app.inject({ method: 'GET', url: '/anything' });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toContain('application/json');
      } finally {
        await app.close();
      }
    });
  });
});
