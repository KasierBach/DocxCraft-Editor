import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDocumentCommands } from './useDocumentCommands';

describe('useDocumentCommands', () => {
  function setup() {
    const pushToast = vi.fn();
    const setStatusMessage = vi.fn();
    const { result } = renderHook(() =>
      useDocumentCommands({ pushToast, setStatusMessage }),
    );
    return { runCommand: result.current.runCommand, pushToast, setStatusMessage };
  }

  it('reports success through status and toast and returns the result', async () => {
    const { runCommand, pushToast, setStatusMessage } = setup();

    let result: string | undefined;
    await act(async () => {
      result = await runCommand('Save', () => Promise.resolve('doc-1'), {
        successMessage: (value) => `Saved ${value}.`,
      });
    });

    expect(result).toBe('doc-1');
    expect(setStatusMessage).toHaveBeenCalledWith('Saved doc-1.');
    expect(pushToast).toHaveBeenCalledWith('success', 'Saved doc-1.');
  });

  it('defaults the success message when none is provided', async () => {
    const { runCommand, pushToast, setStatusMessage } = setup();

    await act(async () => {
      await runCommand('Refresh', () => Promise.resolve(42));
    });

    expect(setStatusMessage).toHaveBeenCalledWith('Refresh completed.');
    expect(pushToast).toHaveBeenCalledWith('success', 'Refresh completed.');
  });

  it('supports an info tone for non-mutating commands', async () => {
    const { runCommand, pushToast } = setup();

    await act(async () => {
      await runCommand('Reload', () => Promise.resolve('ok'), {
        successMessage: () => 'Reloaded document.',
        successTone: 'info',
      });
    });

    expect(pushToast).toHaveBeenCalledWith('info', 'Reloaded document.');
  });

  it('reports errors with the error message and a failure status', async () => {
    const { runCommand, pushToast, setStatusMessage } = setup();

    let result: string | undefined;
    await act(async () => {
      result = await runCommand('Open', () => Promise.reject(new Error('Network gone.')), {
        failureStatus: 'Open failed.',
      });
    });

    expect(result).toBeUndefined();
    expect(setStatusMessage).toHaveBeenCalledWith('Open failed.');
    expect(pushToast).toHaveBeenCalledWith('error', 'Network gone.');
  });

  it('falls back to the label when a non-Error is thrown', async () => {
    const { runCommand, pushToast, setStatusMessage } = setup();

    await act(async () => {
      await runCommand('Duplicate', () => Promise.reject('nope'));
    });

    expect(setStatusMessage).toHaveBeenCalledWith('Duplicate failed.');
    expect(pushToast).toHaveBeenCalledWith('error', 'Duplicate failed.');
  });

  it('does not swallow the error when status reporting throws', async () => {
    const pushToast = vi.fn(() => {
      throw new Error('toast layer down');
    });
    const setStatusMessage = vi.fn();
    const { result } = renderHook(() =>
      useDocumentCommands({ pushToast, setStatusMessage }),
    );

    await expect(
      act(async () => {
        await result.current.runCommand('Save', () => Promise.resolve('doc-1'));
      }),
    ).rejects.toThrow('toast layer down');
  });
});
