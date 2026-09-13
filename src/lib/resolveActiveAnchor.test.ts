import { describe, expect, it } from 'vitest';
import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror';

import type { AnchorTarget } from './anchors';
import { resolveActiveAnchorId } from './resolveActiveAnchor';

function anchor(id: string, paragraphIndex: number): AnchorTarget {
  return { id, label: id, styleId: 'Heading1', paragraphIndex, pageNumber: 1 };
}

const selection = (startParagraphIndex: number) =>
  ({ startParagraphIndex }) as unknown as SelectionState;

const ANCHORS = [anchor('a1', 0), anchor('a2', 5), anchor('a3', 12)];

describe('resolveActiveAnchorId', () => {
  it('returns null without anchors', () => {
    expect(
      resolveActiveAnchorId({ anchors: [], selectionInfo: null, selectionState: null }),
    ).toBe(null);
  });

  it('prefers a direct paragraph id match', () => {
    expect(
      resolveActiveAnchorId({
        anchors: ANCHORS,
        selectionInfo: { paraId: 'a2' },
        selectionState: selection(9),
      }),
    ).toBe('a2');
  });

  it('falls back to the nearest preceding anchor for a paragraph index', () => {
    expect(
      resolveActiveAnchorId({
        anchors: ANCHORS,
        selectionInfo: { paraId: 'unknown' },
        selectionState: selection(9),
      }),
    ).toBe('a2');
  });

  it('returns null before the first anchor unless the first is preferred', () => {
    expect(
      resolveActiveAnchorId({
        anchors: ANCHORS,
        selectionInfo: null,
        selectionState: selection(-1),
      }),
    ).toBe(null);

    expect(
      resolveActiveAnchorId({
        anchors: ANCHORS,
        selectionInfo: null,
        selectionState: selection(-1),
        preferFirstAnchor: true,
      }),
    ).toBe('a1');
  });

  it('uses the fallback id when nothing else matches', () => {
    expect(
      resolveActiveAnchorId({
        anchors: ANCHORS,
        selectionInfo: null,
        selectionState: null,
        fallbackActiveParaId: 'a3',
      }),
    ).toBe('a3');

    expect(
      resolveActiveAnchorId({
        anchors: ANCHORS,
        selectionInfo: null,
        selectionState: null,
        fallbackActiveParaId: 'missing',
        preferFirstAnchor: false,
      }),
    ).toBe(null);
  });
});
