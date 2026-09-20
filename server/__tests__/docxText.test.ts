import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { extractDocxText } from '../docxText';

describe('extractDocxText', () => {
  it('keeps paragraph and line breaks while decoding XML entities', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      '<w:document><w:body><w:p><w:r><w:t>One &amp; two</w:t><w:tab/><w:t>three</w:t><w:br/></w:r></w:p><w:p><w:r><w:t>Next</w:t></w:r></w:p></w:body></w:document>',
    );

    const buffer = await zip.generateAsync({ type: 'uint8array' });

    await expect(extractDocxText(buffer)).resolves.toBe('One & two three\nNext');
  });

  it('returns an empty string when the document part is absent', async () => {
    const buffer = await new JSZip().generateAsync({ type: 'uint8array' });

    await expect(extractDocxText(buffer)).resolves.toBe('');
  });
});
