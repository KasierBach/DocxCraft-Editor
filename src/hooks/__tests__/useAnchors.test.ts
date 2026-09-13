import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AnchorTarget } from '../../lib/anchors';
import { useAnchors } from '../useAnchors';

function anchor(id: string, label: string, styleId: string): AnchorTarget {
  return { id, label, styleId, paragraphIndex: 0, pageNumber: 1 };
}

const HEADING = anchor('h1', 'Quarterly Report', 'Heading1');
const BODY = anchor('b1', 'Ordinary paragraph', 'Normal');

describe('useAnchors', () => {
  it('defaults to the heading-only outline, falling back to all anchors', () => {
    const { result } = renderHook(() => useAnchors());

    act(() => {
      result.current.setAnchors([HEADING, BODY]);
    });
    expect(result.current.filteredAnchors).toEqual([HEADING]);

    act(() => {
      result.current.setAnchors([BODY]);
    });
    expect(result.current.filteredAnchors).toEqual([BODY]);
  });

  it('filters by search query across label and id, case-insensitively', () => {
    const { result } = renderHook(() => useAnchors());

    act(() => {
      result.current.setAnchors([HEADING, BODY]);
      result.current.setFilterStyle('all');
      result.current.setSearchQuery('  report  ');
    });
    expect(result.current.filteredAnchors).toEqual([HEADING]);

    act(() => {
      result.current.setSearchQuery('b1');
    });
    expect(result.current.filteredAnchors).toEqual([BODY]);

    act(() => {
      result.current.setSearchQuery('nothing matches');
    });
    expect(result.current.filteredAnchors).toEqual([]);
  });

  it('tracks unique styles and resets filters', () => {
    const { result } = renderHook(() => useAnchors());

    act(() => {
      result.current.setAnchors([HEADING, BODY]);
      result.current.setSearchQuery('report');
      result.current.setFilterStyle('Heading1');
    });

    expect(result.current.uniqueStyles).toEqual(['Heading1', 'Normal']);

    act(() => {
      result.current.resetFilters();
    });
    expect(result.current.searchQuery).toBe('');
    expect(result.current.filterStyle).toBe('outline');
    expect(result.current.filteredAnchors).toEqual([HEADING]);
  });
});
