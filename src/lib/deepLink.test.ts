import { describe, expect, it } from 'vitest';

import { buildDeepLinkSearch, readDeepLink } from './deepLink';

describe('deepLink', () => {
  it('reads deep-link params for saved documents', () => {
    expect(readDeepLink('?source=saved&documentId=doc-1&paraId=ABC123')).toEqual({
      source: 'saved',
      documentId: 'doc-1',
      paraId: 'ABC123',
    });
  });

  it('builds deep-link params for sample and saved states', () => {
    expect(
      buildDeepLinkSearch({
        source: 'sample',
        documentId: null,
        paraId: 'PARA-1',
      }),
    ).toBe('?source=sample&paraId=PARA-1');

    expect(
      buildDeepLinkSearch({
        source: 'saved',
        documentId: 'doc-1',
        paraId: 'PARA-2',
      }),
    ).toBe('?source=saved&documentId=doc-1&paraId=PARA-2');
  });
});
