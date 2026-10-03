import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  claimInstanceWithPassphrase, compareDocumentVersions, deleteAccount,
  duplicateDocument, exportAccount, listDocuments, loginWithPassphrase,
  logout, readAuthSession, readDocumentContent, readDocumentVersionContent,
  withRequestTimeout,
} from '../documentApi';

// Keep parsing, status handling and request ownership real; only the HTTP
// transport is controlled. Wrong routes/verbs, swallowed failures or a cached
// rejected request must break these independently specified contracts.
describe('document API transport boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['', 'Request failed with status 503.'],
    ['{"message":""}', '{"message":""}'],
    ['{"message":12}', '{"message":12}'],
    ['null', 'null'],
  ])('preserves a useful error when the body is %j', async (body, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 503 }));
    await expect(listDocuments()).rejects.toMatchObject({ status: 503, message });
  });

  it('falls back to HTTP status when the error body cannot be read', async () => {
    const response = new Response('unavailable', { status: 502 });
    await response.text(); // Real consumed body makes a second read reject.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    await expect(listDocuments()).rejects.toMatchObject({ status: 502, message: 'Request failed with status 502.' });
  });

  it('shares an in-flight list but fetches fresh data after it settles', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(pending)
      .mockResolvedValueOnce(new Response('[]'));
    const first = listDocuments();
    const second = listDocuments();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    release(new Response('[]'));
    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toEqual([]);
    await expect(listDocuments()).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not poison future requests after a transport failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network lost'))
      .mockResolvedValueOnce(new Response('[]'));
    await expect(listDocuments()).rejects.toThrow('network lost');
    await expect(listDocuments()).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['current', () => readDocumentContent('missing')],
    ['version', () => readDocumentVersionContent('missing', 'v1')],
  ])('rejects a missing %s binary instead of returning error bytes', async (_kind, read) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"message":"Not found"}', { status: 404 }));
    await expect(read()).rejects.toThrow('Not found');
  });

  it('returns session state from the session endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"authRequired":false,"needsSetup":false,"authenticated":true}'));
    await expect(readAuthSession()).resolves.toEqual({ authRequired: false, needsSetup: false, authenticated: true });
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/session', expect.any(Object));
    expect(fetchSpy.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
  });

  it.each([
    ['login', loginWithPassphrase, '/api/auth/login'],
    ['claim', claimInstanceWithPassphrase, '/api/auth/setup'],
  ] as const)('submits a %s passphrase as JSON and reports rejection', async (_name, submit, endpoint) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{"message":"Denied"}', { status: 401 }));
    await expect(submit('quote"\\value')).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenNthCalledWith(1, endpoint, expect.objectContaining({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: String.raw`{"passphrase":"quote\"\\value"}`,
    }));
    await expect(submit('invalid')).rejects.toThrow('Denied');
  });

  it.each([
    ['logout', logout, '/api/auth/logout', 'POST', 'Sign out failed.'],
    ['account deletion', deleteAccount, '/api/account', 'DELETE', 'Account deletion failed.'],
  ] as const)('uses the correct destructive endpoint for %s and does not swallow denial', async (_name, action, endpoint, method, message) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(action()).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenNthCalledWith(1, endpoint, expect.objectContaining({ method }));
    await expect(action()).rejects.toThrow(message);
  });

  it('exports exact account JSON text and rejects denied export', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"documents":[]}'))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(exportAccount()).resolves.toBe('{"documents":[]}');
    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/account/export', expect.any(Object));
    expect(fetchSpy.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
    await expect(exportAccount()).rejects.toThrow('Account export failed.');
  });

  it('returns the new identity after duplicating a document', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'copy-2', name: 'Report copy.docx', sizeInBytes: 3, revision: 1,
      createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z',
      lastOpenedAt: null, versionCount: 1, deletedAt: null,
    })));
    const copy = await duplicateDocument('original-1');
    expect(copy).toMatchObject({ id: 'copy-2', name: 'Report copy.docx', revision: 1 });
    expect(fetchSpy).toHaveBeenCalledWith('/api/documents/original-1/duplicate', expect.objectContaining({ method: 'POST' }));
  });

  it('encodes version comparison identifiers without adding extra query parameters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"added":["new text"],"removed":["old text"]}'));
    await expect(compareDocumentVersions('doc/1', 'from&other=x', 'to?next=y')).resolves.toEqual({ added: ['new text'], removed: ['old text'] });
    expect(fetchSpy).toHaveBeenCalledWith('/api/documents/doc%2F1/compare?from=from%26other%3Dx&to=to%3Fnext%3Dy', expect.any(Object));
    expect(fetchSpy.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
  });

  it('keeps request options usable on a browser without AbortSignal.timeout', () => {
    vi.stubGlobal('AbortSignal', { timeout: undefined });
    const init = { method: 'POST', body: 'payload' };
    expect(withRequestTimeout(init)).toEqual({ method: 'POST', body: 'payload' });
  });
});
