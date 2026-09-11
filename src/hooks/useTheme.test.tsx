import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './useTheme';

function createMatchMediaStub(matches: boolean) {
    return vi.fn().mockImplementation((query: string) => ({
        matches: matches && query.includes('dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

function setSystemTheme(theme: 'light' | 'dark') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaStub(theme === 'dark'),
    });
}

describe('useTheme', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
        delete document.documentElement.dataset.theme;
    });

    it('defaults to the system theme when no stored preference exists', () => {
        setSystemTheme('dark');
        const { result } = renderHook(() => useTheme());

        expect(result.current.theme).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('prefers the stored theme over the system theme', () => {
        setSystemTheme('dark');
        window.localStorage.setItem('docx-editor-theme', 'light');

        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('light');
        expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('toggles the theme and persists the choice', () => {
        setSystemTheme('light');
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current.toggleTheme();
        });

        expect(result.current.theme).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(window.localStorage.getItem('docx-editor-theme')).toBe('dark');
    });

    it('updates the theme explicitly and applies it to the document', () => {
        setSystemTheme('light');
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current.setTheme('dark');
        });

        expect(result.current.theme).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('falls back to light when matchMedia is unavailable', () => {
        (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;

        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('light');
    });
});
