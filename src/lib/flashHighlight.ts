import { findFlashHighlightTarget } from './highlightTarget';

const FLASH_CLASS_NAME = 'flash-highlight';
const FLASH_DURATION_MS = 1500;
const RETRY_INTERVAL_MS = 100;
const MAX_SEARCH_TIME_MS = 2000;

export function flashParagraphHighlight(
  root: HTMLElement,
  selection: Selection | null,
): () => void {
  const startTime = Date.now();
  let retryTimerId: number | null = null;
  let removeTimerId: number | null = null;
  let isCancelled = false;

  const clearPendingTimers = () => {
    if (retryTimerId !== null) {
      window.clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    if (removeTimerId !== null) {
      window.clearTimeout(removeTimerId);
      removeTimerId = null;
    }
  };

  const applyFlashHighlight = (targetElement: HTMLElement) => {
    if (!root.isConnected) {
      return;
    }

    targetElement.classList.remove(FLASH_CLASS_NAME);
    void targetElement.offsetWidth;
    targetElement.classList.add(FLASH_CLASS_NAME);

    if (root.parentElement) {
      root.parentElement.scrollLeft = 0;
    }
    root.scrollLeft = 0;
    window.scrollTo(0, 0);

    removeTimerId = window.setTimeout(() => {
      targetElement.classList.remove(FLASH_CLASS_NAME);
    }, FLASH_DURATION_MS);
  };

  const attempt = () => {
    if (isCancelled || !root.isConnected) {
      return;
    }

    const targetElement = findFlashHighlightTarget(root, selection);
    if (targetElement) {
      applyFlashHighlight(targetElement);
      return;
    }

    if (Date.now() - startTime < MAX_SEARCH_TIME_MS) {
      retryTimerId = window.setTimeout(attempt, RETRY_INTERVAL_MS);
    }
  };

  attempt();

  return () => {
    isCancelled = true;
    clearPendingTimers();
  };
}
