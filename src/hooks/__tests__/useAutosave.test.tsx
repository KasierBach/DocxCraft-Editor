import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutosave } from '../useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves once editing has settled', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave({ enabled: true, isDirty: true, save, delayMs: 1000 }));

    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('waits for the delay before saving', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave({ enabled: true, isDirty: true, save, delayMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('does not save a document that is not dirty', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave({ enabled: true, isDirty: false, save, delayMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('does not create a document for an unsaved draft', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave({ enabled: false, isDirty: true, save, delayMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('saves once per dirty period rather than repeatedly', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave({ enabled: true, isDirty: true, save, delayMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves again after a later edit', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ isDirty }) => useAutosave({ enabled: true, isDirty, save, delayMs: 1000 }),
      { initialProps: { isDirty: true } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ isDirty: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ isDirty: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('drops the pending save when the component unmounts', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useAutosave({ enabled: true, isDirty: true, save, delayMs: 1000 }),
    );

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('keeps working after a failed save, without looping', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    renderHook(() => useAutosave({ enabled: true, isDirty: true, save, delayMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // A failure must not spin: one attempt per dirty period.
    expect(save).toHaveBeenCalledTimes(1);
  });
});
