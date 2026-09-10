// @vitest-environment node

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { validateDocx } from './docxValidation.ts';

async function createDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', '<document/>');
  return zip.generateAsync({ type: 'uint8array' });
}

describe('validateDocx', () => {
  it('accepts a minimal DOCX and rejects malformed or incomplete archives', async () => {
    await expect(validateDocx(await createDocx())).resolves.toBeUndefined();
    await expect(validateDocx(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).rejects.toThrow();

    const missingDocument = new JSZip();
    missingDocument.file('[Content_Types].xml', '<Types/>');
    await expect(
      validateDocx(await missingDocument.generateAsync({ type: 'uint8array' })),
    ).rejects.toThrow(/missing required/i);
  });
});
