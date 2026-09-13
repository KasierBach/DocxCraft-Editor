import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

function fireKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...modifiers,
    });
    window.dispatchEvent(event);
    return event;
}

describe('useKeyboardShortcuts', () => {
    let handler: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
        handler = vi.fn();
    });

    afterEach(() => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    });

    it('invokes the handler when the plain key matches', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 'k', handler }] }),
        );

        fireKey('k');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches keys case-insensitively', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 's', handler }] }),
        );

        fireKey('S');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('invokes the handler for ctrl and meta shortcuts', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 's', ctrlKey: true, handler }] }),
        );

        fireKey('s', { ctrlKey: true });
        fireKey('s', { metaKey: true });
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('ignores a modified keystroke for a plain shortcut', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 'k', handler }] }),
        );

        fireKey('k', { ctrlKey: true });
        expect(handler).not.toHaveBeenCalled();
    });

    it('requires shift and alt only when the shortcut declares them', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 'p', shiftKey: true, handler }] }),
        );

        fireKey('P', { shiftKey: true });
        expect(handler).toHaveBeenCalledTimes(1);

        fireKey('p');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('prevents the default browser behaviour when a shortcut matches', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 's', ctrlKey: true, handler }] }),
        );

        const event = fireKey('s', { ctrlKey: true });
        expect(event.defaultPrevented).toBe(true);
    });

    it('does not fire shortcuts while typing in an input without modifiers', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 'k', handler }] }),
        );

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        fireKey('k');
        expect(handler).not.toHaveBeenCalled();

        input.remove();
    });

    it('still fires modifier shortcuts while focused on an input', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 's', ctrlKey: true, handler }] }),
        );

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        fireKey('s', { ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(1);

        input.remove();
    });

    it('does not fire shortcuts while focused on a contenteditable element', () => {
        renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 'k', handler }] }),
        );

        const editor = document.createElement('div');
        editor.setAttribute('contenteditable', 'true');
        document.body.appendChild(editor);
        editor.focus();

        fireKey('k');
        expect(handler).not.toHaveBeenCalled();

        editor.remove();
    });

    it('stops after the first matching shortcut', () => {
        const secondHandler = vi.fn();
        renderHook(() =>
            useKeyboardShortcuts({
                shortcuts: [
                    { key: 'k', handler },
                    { key: 'k', handler: secondHandler },
                ],
            }),
        );

        fireKey('k');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(secondHandler).not.toHaveBeenCalled();
    });

    it('uses the latest shortcuts array after rerenders', () => {
        const { rerender } = renderHook(
            ({ shortcuts }: { shortcuts: Array<{ key: string; handler: () => void }> }) =>
                useKeyboardShortcuts({ shortcuts }),
            { initialProps: { shortcuts: [{ key: 'a', handler }] } },
        );

        const nextHandler = vi.fn();
        act(() => {
            rerender({ shortcuts: [{ key: 'b', handler: nextHandler }] });
        });

        fireKey('a');
        expect(handler).not.toHaveBeenCalled();

        fireKey('b');
        expect(nextHandler).toHaveBeenCalledTimes(1);
    });

    it('removes the listener when disabled', () => {
        const { rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) =>
                useKeyboardShortcuts({ shortcuts: [{ key: 'k', handler }], enabled }),
            { initialProps: { enabled: true } },
        );

        act(() => {
            rerender({ enabled: false });
        });

        fireKey('k');
        expect(handler).not.toHaveBeenCalled();
    });

    it('detaches the listener on unmount', () => {
        const { unmount } = renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [{ key: 'k', handler }] }),
        );

        unmount();
        fireKey('k');
        expect(handler).not.toHaveBeenCalled();
    });
});
