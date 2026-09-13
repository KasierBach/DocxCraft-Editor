import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useToastManager } from '../useToastManager';

describe('useToastManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a single visible toast, replacing the previous one', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.pushToast('info', 'first');
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.pushToast('error', 'second');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toBe('second');
  });

  it('auto-dismisses after the configured timeout', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToastManager({ defaultTimeout: 1000 }));

    act(() => {
      result.current.pushToast('success', 'saved');
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismisses on request without waiting for the timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToastManager({ defaultTimeout: 5000 }));

    act(() => {
      result.current.pushToast('info', 'bye');
    });
    const toastId = result.current.toasts[0]?.id ?? 0;

    act(() => {
      result.current.dismissToast(toastId);
    });
    expect(result.current.toasts).toHaveLength(0);
  });
});
