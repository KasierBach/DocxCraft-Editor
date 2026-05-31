import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecoveryDraft } from './useRecoveryDraft';
import { clearRecoverySnapshot } from '../lib/recoveryStore';

describe('useRecoveryDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearRecoverySnapshot();
  });

  it('autosaves a recovery snapshot after the delay when dirty', async () => {
    const getBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    const { result } = renderHook(() =>
      useRecoveryDraft({
        sourceKind: 'saved-document',
        documentId: 'doc-1',
        documentName: 'Proposal.docx',
        activeParaId: 'para-1',
        isDirty: true,
        getBuffer,
        autosaveDelayMs: 2000,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(getBuffer).toHaveBeenCalledTimes(1);
    expect(result.current.recoverySnapshot?.documentId).toBe('doc-1');
    expect(Array.from(new Uint8Array(result.current.recoverySnapshot?.buffer ?? new ArrayBuffer(0)))).toEqual([1, 2, 3]);
  });

  it('clears a stored recovery snapshot', async () => {
    const getBuffer = vi.fn().mockResolvedValue(new Uint8Array([4, 5]).buffer);
    const { result } = renderHook(() =>
      useRecoveryDraft({
        sourceKind: 'sample',
        documentId: null,
        documentName: 'Built-in sample.docx',
        activeParaId: null,
        isDirty: true,
        getBuffer,
        autosaveDelayMs: 1000,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(result.current.recoverySnapshot).not.toBeNull();

    act(() => {
      result.current.discardRecovery();
    });

    expect(result.current.recoverySnapshot).toBeNull();
  });
});
