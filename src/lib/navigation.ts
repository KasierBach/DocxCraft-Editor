/**
 * Full-page navigation. Isolated behind a function so tests can stub it without
 * touching jsdom's non-configurable `window.location`.
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
