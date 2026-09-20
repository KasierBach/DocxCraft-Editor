import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reportServerError } from '../errorTracking.ts';

describe('reportServerError', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('does nothing when no sink is configured', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    reportServerError(undefined, new Error('secret'), 'req-1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a redacted error envelope and ignores sink failures', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sink down'));
    reportServerError('https://errors.example.test/ingest', new Error('database password leaked'), 'req-2');
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(String(init?.body))).toMatchObject({ message: 'database password leaked', name: 'Error', requestId: 'req-2' });
  });
});
