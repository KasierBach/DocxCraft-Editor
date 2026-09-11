import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'docx-editor-theme';

function readStoredTheme(): Theme | null {
    try {
        const value = window.localStorage.getItem(THEME_STORAGE_KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch {
        return null;
    }
}

function readSystemTheme(): Theme {
    if (typeof window.matchMedia !== 'function') {
        return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? readSystemTheme());

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    // Follow OS theme changes while the user has no explicit preference.
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') {
            return undefined;
        }
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (readStoredTheme() === null) {
                setTheme(readSystemTheme());
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const updateTheme = useCallback((nextTheme: Theme) => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
            // Storage can be unavailable (private mode); the in-memory theme still applies.
        }
    }, []);

    const toggleTheme = useCallback(() => {
        updateTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, updateTheme]);

    return { theme, setTheme: updateTheme, toggleTheme };
}
