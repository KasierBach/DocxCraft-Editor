import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../documentApi', () => ({
  readErrorMessage: vi.fn(async (response: Response) => `status ${response.status}`),
  withRequestTimeout: (init: RequestInit = {}) => init,
}));

import {
  addDocumentComment,
  bulkUpdateWorkspaceDocuments,
  createApiToken,
  deleteDocumentShare,
  getWorkspaceUsage,
  importDocumentUrl,
  listApiTokens,
  listDocumentComments,
  listDocumentShares,
  listWorkspaceDocuments,
  listWorkspaceNotifications,
  markWorkspaceNotificationsRead,
  resolveDocumentComment,
  revokeApiToken,
  streamAiChat,
  updateAiSettings,
  updateWorkspaceDocument,
  upsertDocumentShare,
} from '../workspaceApi';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('workspaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('covers workspace CRUD, metadata, sharing, notifications, tokens, and AI settings', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ documents: 2, bytes: 4096, limits: null }))
      .mockResolvedValueOnce(jsonResponse({ id: 'd1' }))
      .mockResolvedValueOnce(jsonResponse({ updated: 2 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'd2', name: 'Imported.docx' }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 'c1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'c1', resolvedAt: 'now' }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 's1' }))
      .mockResolvedValueOnce(jsonResponse(undefined, 204))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(undefined, 204))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 't1', token: 'secret' }))
      .mockResolvedValueOnce(jsonResponse(undefined, 204))
      .mockResolvedValueOnce(jsonResponse({ provider: 'openai-compatible', model: 'test', baseUrl: null, enabled: false }));

    await listWorkspaceDocuments('hello world');
    await getWorkspaceUsage();
    await updateWorkspaceDocument('d/1', { folder: 'Reports', tags: ['q3'], isStarred: true });
    await bulkUpdateWorkspaceDocuments(['d1', 'd2'], { folder: null });
    await importDocumentUrl('https://example.com/report.docx');
    await listDocumentComments('d1');
    await addDocumentComment('d1', { body: 'Review this', paraId: null });
    await resolveDocumentComment('c1', true);
    await listDocumentShares('d1');
    await upsertDocumentShare('d1', 'person@example.com', 'editor');
    await deleteDocumentShare('d1', 's1');
    await listWorkspaceNotifications();
    await markWorkspaceNotificationsRead();
    await listApiTokens();
    await createApiToken('CLI');
    await revokeApiToken('t1');
    await updateAiSettings({ model: 'test', enabled: false });

    expect(fetchMock).toHaveBeenCalledTimes(17);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/workspace/documents?q=hello%20world');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1].body as string)).toEqual({ folder: 'Reports', tags: ['q3'], isStarred: true });
    expect(fetchMock.mock.calls[10]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(fetchMock.mock.calls[16]?.[0]).toBe('/api/ai/settings');
  });

  it('reports non-OK responses and parses an SSE stream whose final event has no newline', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'no access' }, 403));
    await expect(listWorkspaceNotifications()).rejects.toThrow('status 403');

    const chunks = [
      'data: {"type":"text","text":"Hello"}\n\n',
      'data: {"type":"text","text":" world"}\n\n',
      'data: {"type":"done"}',
    ];
    const reader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[0]), done: false })
        .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[1]), done: false })
        .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[2]), done: false })
        .mockResolvedValueOnce({ value: undefined, done: true }),
    };
    fetchMock.mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

    const text: string[] = [];
    await streamAiChat([{ role: 'user', content: 'hello' }], undefined, (value) => text.push(value));
    expect(text.join('')).toBe('Hello world');
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'POST', signal: expect.any(AbortSignal) });
  });
});
