import { describe, expect, it } from 'vitest';

import { collectAnchorTargets, type PageContent } from './anchors';

describe('collectAnchorTargets', () => {
  it('collects non-empty paragraphs with page number and text preview', () => {
    const pages: PageContent[] = [
      {
        pageNumber: 1,
        text: 'ignored',
        paragraphs: [
          { paraId: 'A1000001', text: 'Overview', styleId: 'Heading1' },
          { paraId: 'A1000002', text: '   ' },
          { paraId: 'A1000003', text: 'Implementation details for the anchor demo.' },
        ],
      },
      {
        pageNumber: 2,
        text: 'ignored',
        paragraphs: [{ paraId: 'A2000001', text: 'Wrap up', styleId: 'Heading2' }],
      },
    ];

    expect(collectAnchorTargets(pages)).toEqual([
      {
        id: 'A1000001',
        label: 'Overview',
        pageNumber: 1,
        paragraphIndex: 0,
        styleId: 'Heading1',
      },
      {
        id: 'A1000003',
        label: 'Implementation details for the anchor demo.',
        pageNumber: 1,
        paragraphIndex: 2,
        styleId: undefined,
      },
      {
        id: 'A2000001',
        label: 'Wrap up',
        pageNumber: 2,
        paragraphIndex: 3,
        styleId: 'Heading2',
      },
    ]);
  });

  it('trims long paragraph text into a compact label', () => {
    const pages: PageContent[] = [
      {
        pageNumber: 3,
        text: 'ignored',
        paragraphs: [
          {
            paraId: 'LONG0001',
            text: 'This is a very long paragraph preview that should be shortened for the navigation sidebar so the button stays readable.',
          },
        ],
      },
    ];

    expect(collectAnchorTargets(pages)[0]).toEqual({
      id: 'LONG0001',
      label: 'This is a very long paragraph preview that should be shortened...',
      pageNumber: 3,
      paragraphIndex: 0,
      styleId: undefined,
    });
  });
});
