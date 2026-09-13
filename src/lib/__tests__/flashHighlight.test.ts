import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flashParagraphHighlight } from '../flashHighlight';

function createParagraph() {
  const paragraph = document.createElement('div');
  paragraph.className = 'layout-paragraph';
  paragraph.textContent = 'target';
  return paragraph;
}

function createSelectionWithin(anchorNode: Node) {
  const range = document.createRange();
  range.selectNodeContents(anchorNode);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

describe('flashParagraphHighlight', () => {
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.getSelection()?.removeAllRanges();
    root.remove();
    vi.useRealTimers();
  });

  it('adds the flash class to the paragraph containing the selection', () => {
    const paragraph = createParagraph();
    root.appendChild(paragraph);
    const selection = createSelectionWithin(paragraph);

    flashParagraphHighlight(root, selection);

    expect(paragraph.classList.contains('flash-highlight')).toBe(true);
    expect(root.scrollLeft).toBe(0);
  });

  it('removes the flash class after the highlight duration', () => {
    const paragraph = createParagraph();
    root.appendChild(paragraph);
    const selection = createSelectionWithin(paragraph);

    flashParagraphHighlight(root, selection);
    vi.advanceTimersByTime(1500);

    expect(paragraph.classList.contains('flash-highlight')).toBe(false);
  });

  it('retries until the target element appears', () => {
    const selectionStub = {} as Selection;

    flashParagraphHighlight(root, selectionStub);
    vi.advanceTimersByTime(100);
    expect(root.querySelector('.layout-paragraph')).toBeNull();

    const paragraph = createParagraph();
    root.appendChild(paragraph);
    vi.advanceTimersByTime(100);

    expect(paragraph.classList.contains('flash-highlight')).toBe(false);
  });

  it('gives up after the maximum search window', () => {
    const selectionStub = {} as Selection;

    flashParagraphHighlight(root, selectionStub);
    vi.advanceTimersByTime(3000);

    const paragraph = createParagraph();
    root.appendChild(paragraph);
    vi.advanceTimersByTime(100);

    expect(paragraph.classList.contains('flash-highlight')).toBe(false);
  });
});
