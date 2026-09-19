import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteDocument,
  listDocuments,
  listDocumentVersions,
  listTrash,
  purgeDocument,
  readDocumentContent,
  readDocumentVersionContent,
  renameDocument,
  restoreDocument,
  saveDocument,
} from '../documentApi';

// Pins the timeout signal wiring whenever the test environment supports
// AbortSignal.timeout, so a dropped withRequestTimeout() call fails tests.
const expectedFetchInit =
  typeof AbortSignal.timeout === 'function'
    ? expect.objectContaining({ signal: expect.anything() })
    : expect.objectContaining({});

describe('documentApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the status of a rejected save so a conflict is detectable without matching text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Document was changed by another client.' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      saveDocument({ id: 'doc-1', name: 'Proposal.docx', buffer: new ArrayBuffer(8), revision: 3 }),
    ).rejects.toMatchObject({
      name: 'DocumentApiError',
      status: 409,
      message: 'Document was changed by another client.',
    });
  });

  it('lists saved documents', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'doc-1',
            name: 'Proposal.docx',
            createdAt: '2026-05-25T05:20:00.000Z',
            updatedAt: '2026-05-25T05:21:00.000Z',
            sizeInBytes: 1024,
            lastOpenedAt: null,
            versionCount: 1,
          },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const documents = await listDocuments();

    expect(fetchSpy).toHaveBeenCalledWith('/api/documents', expectedFetchInit);
    expect(documents).toHaveLength(1);
    expect(documents[0]?.name).toBe('Proposal.docx');
  });

  it('lists document versions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'ver-2',
            documentId: 'doc-1',
            name: 'Proposal Final.docx',
            createdAt: '2026-05-25T05:21:00.000Z',
            sizeInBytes: 2048,
          },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const versions = await listDocumentVersions('doc-1');

    expect(fetchSpy).toHaveBeenCalledWith('/api/documents/doc-1/versions', expectedFetchInit);
    expect(versions[0]?.id).toBe('ver-2');
  });

  it('saves new and existing documents with binary payloads', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'doc-1',
            name: 'Proposal.docx',
            createdAt: '2026-05-25T05:20:00.000Z',
            updatedAt: '2026-05-25T05:21:00.000Z',
            sizeInBytes: 3,
            lastOpenedAt: null,
            versionCount: 1,
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'doc-1',
            name: 'Proposal v2.docx',
            createdAt: '2026-05-25T05:20:00.000Z',
            updatedAt: '2026-05-25T05:22:00.000Z',
            sizeInBytes: 4,
            lastOpenedAt: null,
            versionCount: 2,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    const createBuffer = new Uint8Array([1, 2, 3]).buffer;
    const updateBuffer = new Uint8Array([4, 5, 6, 7]).buffer;

    await saveDocument({ name: 'Proposal.docx', buffer: createBuffer });
    await saveDocument({ id: 'doc-1', name: 'Proposal v2.docx', buffer: updateBuffer });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/documents',
      expect.objectContaining({
        method: 'POST',
        body: createBuffer,
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Proposal.docx',
        },
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/documents/doc-1',
      expect.objectContaining({
        method: 'PUT',
        body: updateBuffer,
        headers: {
          'content-type': 'application/octet-stream',
          'x-document-name': 'Proposal%20v2.docx',
        },
      }),
    );
  });

  it('downloads saved document content and version content', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(new Uint8Array([9, 8, 7]), {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        }),
      );

    const latestBuffer = await readDocumentContent('doc-1', { markOpened: true });
    const versionBuffer = await readDocumentVersionContent('doc-1', 'ver-1');

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/documents/doc-1/content?markOpened=true', expectedFetchInit);
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/documents/doc-1/versions/ver-1/content', expectedFetchInit);
    expect(Array.from(new Uint8Array(latestBuffer))).toEqual([9, 8, 7]);
    expect(Array.from(new Uint8Array(versionBuffer))).toEqual([1, 2, 3]);
  });

  it('does not deduplicate opened and plain content requests together', async () => {
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce(new Response(new Uint8Array([2]), { status: 200 }));

    const opened = readDocumentContent('doc-1', { markOpened: true });
    const plain = readDocumentContent('doc-1', { markOpened: false });
    resolveFirst(new Response(new Uint8Array([1]), { status: 200 }));

    await Promise.all([opened, plain]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/documents/doc-1/content?markOpened=true', expectedFetchInit);
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/documents/doc-1/content?markOpened=false', expectedFetchInit);
  });

  it('encodes non-ASCII document names before sending request headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'doc-2',
          name: 'Bao cao so sanh.docx',
          createdAt: '2026-05-25T05:20:00.000Z',
          updatedAt: '2026-05-25T05:21:00.000Z',
          sizeInBytes: 3,
          lastOpenedAt: null,
          versionCount: 1,
        }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await saveDocument({
      name: 'Báo cáo Tabularis so với Data Explorer.docx',
      buffer: new Uint8Array([1, 2, 3]).buffer,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/documents',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-document-name':
            'B%C3%A1o%20c%C3%A1o%20Tabularis%20so%20v%E1%BB%9Bi%20Data%20Explorer.docx',
        }),
      }),
    );
  });

  it('renames and deletes saved documents', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'doc-1',
            name: 'Proposal Renamed.docx',
            createdAt: '2026-05-25T05:20:00.000Z',
            updatedAt: '2026-05-25T05:24:00.000Z',
            sizeInBytes: 1024,
            lastOpenedAt: null,
            versionCount: 2,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await renameDocument('doc-1', 'Proposal Renamed.docx');
    await deleteDocument('doc-1');

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/documents/doc-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Proposal Renamed.docx',
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/documents/doc-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('lists trashed documents, restores one, and purges one', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'doc-1',
              name: 'Proposal.docx',
              createdAt: '2026-05-25T05:20:00.000Z',
              updatedAt: '2026-05-25T05:21:00.000Z',
              sizeInBytes: 1024,
              lastOpenedAt: null,
              versionCount: 1,
              deletedAt: '2026-05-26T05:00:00.000Z',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'doc-1',
            name: 'Proposal.docx',
            createdAt: '2026-05-25T05:20:00.000Z',
            updatedAt: '2026-05-25T05:21:00.000Z',
            sizeInBytes: 1024,
            lastOpenedAt: null,
            versionCount: 1,
            deletedAt: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const trashed = await listTrash();
    const restored = await restoreDocument('doc-1');
    await purgeDocument('doc-1');

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/documents/trash', expectedFetchInit);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/documents/doc-1/restore',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      '/api/documents/doc-1/purge',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(trashed[0]?.deletedAt).toBe('2026-05-26T05:00:00.000Z');
    expect(restored.deletedAt).toBeNull();
  });

  it('surfaces purge failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Document not found.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(purgeDocument('doc-1')).rejects.toThrow('Document not found.');
  });

  it('surfaces the server message from JSON error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Document not found.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(deleteDocument('doc-1')).rejects.toThrow('Document not found.');
  });

  it('falls back to the status text for non-JSON error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>Gateway error</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(deleteDocument('doc-1')).rejects.toThrow('<html>Gateway error</html>');
  });

  it('reports a clear error when a success response is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>index</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(listDocuments()).rejects.toThrow('The server returned an unexpected response.');
  });
});
