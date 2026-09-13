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

// jsdom does not implement smooth scrolling used by the landing page.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
}

// jsdom does not implement IntersectionObserver, used by the landing page's
// reveal/count-up animations. The stub never fires, so animations stay at
// their initial (rendered) state.
if (typeof globalThis.IntersectionObserver === 'undefined') {
    class IntersectionObserverStub {
        root = null;
        rootMargin = '';
        thresholds: number[] = [];
        observe() { }
        unobserve() { }
        disconnect() { }
        takeRecords() {
            return [];
        }
    }
    globalThis.IntersectionObserver =
        IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
