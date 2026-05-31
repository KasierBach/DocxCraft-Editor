import { describe, expect, it } from 'vitest';

import { findFlashHighlightTarget } from './highlightTarget';

describe('findFlashHighlightTarget', () => {
  it('prefers the selected paragraph instead of a larger ancestor container', () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-debug-anchor="6B5634A4">
          <div class="layout-table">
            <div class="layout-table-cell">
              <div class="layout-paragraph" data-pm-start="10" data-pm-end="20">
                <span>Bang 1. Ban do chuc nang</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const root = document.getElementById('root')!;
    const paragraph = root.querySelector('.layout-paragraph') as HTMLElement;
    const textNode = paragraph.querySelector('span')!.firstChild!;
    const selection = window.getSelection()!;
    const range = document.createRange();

    selection.removeAllRanges();
    range.setStart(textNode, 3);
    range.collapse(true);
    selection.addRange(range);

    expect(findFlashHighlightTarget(root, selection)).toBe(paragraph);
  });

  it('returns null when the current selection is outside the editor root', () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="layout-paragraph"><span>Inside editor</span></div>
      </div>
      <div id="outside"><span>Outside editor</span></div>
    `;

    const root = document.getElementById('root')!;
    const outsideTextNode = document.querySelector('#outside span')!.firstChild!;
    const selection = window.getSelection()!;
    const range = document.createRange();

    selection.removeAllRanges();
    range.setStart(outsideTextNode, 2);
    range.collapse(true);
    selection.addRange(range);

    expect(findFlashHighlightTarget(root, selection)).toBeNull();
  });
});
