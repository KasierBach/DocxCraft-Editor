// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';

import { API_VERSION, buildDocumentApiApp } from './app.ts';
import { createDocumentStore } from './documentStore.ts';

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
});
