import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia; provide a minimal stub used by hooks
// such as useTheme to detect the preferred color scheme.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
        }),
    });
}

// jsdom does not implement ResizeObserver, which the docx editor relies on.
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
        observe() { }
        unobserve() { }
        disconnect() { }
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
