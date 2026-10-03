import { afterEach, describe, expect, it, vi } from 'vitest';

import { disconnectProvider, listActivity, listProviders, listSessions, revokeOtherSessions, revokeSession, updateDisplayName } from '../accountApi';

describe('account API contracts', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('updates a Unicode display name with the JSON payload and timeout', async () => {
    const user = { id: 'user-1', email: 'test@example.com', name: 'Nguyễn An', avatarUrl: null, isAnonymous: false, createdAt: '2026-10-03T00:00:00Z' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(user)));
    await expect(updateDisplayName('Nguyễn An')).resolves.toEqual(user);
    expect(fetchSpy).toHaveBeenCalledWith('/api/account', expect.objectContaining({
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: '{"displayName":"Nguyễn An"}', signal: expect.any(AbortSignal),
    }));
  });

  it('keeps sessions and provider responses separate', async () => {
    const sessions = [{ id: 's1', createdAt: '2026-10-03T00:00:00Z', expiresAt: '2026-11-03T00:00:00Z', ip: null, device: 'Browser', isCurrent: true }];
    const providers = [{ id: 'google', label: 'Google', linkedAt: '2026-10-03T00:00:00Z' }];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      new Response(JSON.stringify(url === '/api/account/sessions' ? sessions : providers)));
    await expect(listSessions()).resolves.toEqual(sessions);
    await expect(listProviders()).resolves.toEqual(providers);
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['/api/account/sessions', '/api/account/providers']);
  });

  it.each([
    { action: disconnectProvider, path: '/api/account/providers/google%2Femail%3Fid%3D1' },
    { action: revokeSession, path: '/api/account/sessions/google%2Femail%3Fid%3D1' },
  ])('encodes deletion IDs and handles empty 204 at $path', async ({ action, path }) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(action('google/email?id=1')).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(path, expect.objectContaining({ method: 'DELETE' }));
  });

  it('returns the server count when revoking other sessions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"revoked":2}'));
    await expect(revokeOtherSessions()).resolves.toEqual({ revoked: 2 });
    expect(fetchSpy).toHaveBeenCalledWith('/api/account/sessions', expect.objectContaining({ method: 'DELETE' }));
  });

  it.each([
    { cursor: undefined, limit: undefined, path: '/api/account/activity' },
    { cursor: null, limit: 0, path: '/api/account/activity?limit=0' },
    { cursor: 'A&B + tiếng Việt', limit: 10, path: '/api/account/activity?cursor=A%26B+%2B+ti%E1%BA%BFng+Vi%E1%BB%87t&limit=10' },
  ])('builds activity pagination without mixing query fields: $path', async ({ cursor, limit, path }) => {
    const page = { events: [], nextCursor: null };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(page)));
    await expect(listActivity(cursor, limit)).resolves.toEqual(page);
    expect(fetchSpy).toHaveBeenCalledWith(path, expect.any(Object));
  });

  it.each([401, 403, 404, 409, 429, 500])('preserves HTTP %i and structured error details', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"message":"Denied"}', { status }));
    await expect(listSessions()).rejects.toMatchObject({ name: 'AccountApiError', message: 'Denied', status });
  });

  it('preserves non-JSON gateway errors for safe rendering by the caller', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<h1>Unavailable</h1>', { status: 502 }));
    await expect(listProviders()).rejects.toMatchObject({ status: 502, message: '<h1>Unavailable</h1>' });
  });

  it('does not replay a failed account mutation', async () => {
    const error = new TypeError('Network unavailable');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(error);
    await expect(revokeOtherSessions()).rejects.toBe(error);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed successful JSON rather than returning a fake session list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not JSON'));
    await expect(listSessions()).rejects.toMatchObject({ name: 'SyntaxError' });
  });
});
