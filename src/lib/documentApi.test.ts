import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteDocument,
  listDocuments,
  listDocumentVersions,
  readDocumentContent,
  readDocumentVersionContent,
  renameDocument,
  saveDocument,
} from './documentApi';

describe('documentApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    expect(fetchSpy).toHaveBeenCalledWith('/api/documents');
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

    expect(fetchSpy).toHaveBeenCalledWith('/api/documents/doc-1/versions');
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

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/documents/doc-1/content?markOpened=true');
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/documents/doc-1/versions/ver-1/content');
    expect(Array.from(new Uint8Array(latestBuffer))).toEqual([9, 8, 7]);
    expect(Array.from(new Uint8Array(versionBuffer))).toEqual([1, 2, 3]);
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
});
