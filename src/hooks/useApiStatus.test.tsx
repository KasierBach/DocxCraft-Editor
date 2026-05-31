import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useApiStatus } from './useApiStatus';

describe('useApiStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports a connected API when health checks succeed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          apiVersion: '2026-05-25-fastify-ts',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { result } = renderHook(() => useApiStatus({ pollIntervalMs: 5000 }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.apiVersion).toBe('2026-05-25-fastify-ts');
  });

  it('reports an offline API when health checks fail', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useApiStatus({ pollIntervalMs: 5000 }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('offline');

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('offline');
  });
});
