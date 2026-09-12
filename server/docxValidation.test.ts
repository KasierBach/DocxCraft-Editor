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

function findCentralDirectoryEntry(view: DataView, name: string) {
  for (let offset = 0; offset + 46 <= view.byteLength; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;

    const nameLength = view.getUint16(offset + 28, true);
    if (offset + 46 + nameLength > view.byteLength) continue;

    const entryName = String.fromCharCode(
      ...new Uint8Array(view.buffer, view.byteOffset + offset + 46, nameLength),
    );
    if (entryName === name) {
      return offset;
    }
  }

  throw new Error(`Central directory entry not found: ${name}`);
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

  it('rejects archives that claim to expand beyond the uncompressed byte limit', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    zip.file('word/document.xml', '<document/>');

    const buffer = await zip.generateAsync({ type: 'uint8array' });
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Grow the uncompressed size field of a central directory entry far beyond
    // the safe limit; the parser must reject it from header values alone,
    // before any decompression happens.
    const entryOffset = findCentralDirectoryEntry(view, 'word/document.xml');
    view.setUint32(entryOffset + 24, 500 * 1024 * 1024, true);

    await expect(validateDocx(buffer)).rejects.toThrow(/beyond the safe limit/i);
  });

  it('rejects archives whose central directory is corrupt', async () => {
    const buffer = await createDocx();
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const entryOffset = findCentralDirectoryEntry(view, 'word/document.xml');
    view.setUint32(entryOffset, 0xdeadbeef, true);

    await expect(validateDocx(buffer)).rejects.toThrow();
  });

  it('rejects archives containing an unsafe traversal path', async () => {
    const buffer = await createDocx();
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Rename a central directory entry in place to include a ".." segment.
    // The replacement must keep the recorded name length, so pad the unsafe
    // name with a trailing slash to match "word/document.xml".
    const entryOffset = findCentralDirectoryEntry(view, 'word/document.xml');
    const nameLength = view.getUint16(entryOffset + 28, true);
    const unsafeName = '../word/evil.docx';
    expect(unsafeName.length).toBe(nameLength);
    const nameStart = entryOffset + 46;
    for (let index = 0; index < unsafeName.length; index += 1) {
      buffer[nameStart + index] = unsafeName.charCodeAt(index);
    }

    await expect(validateDocx(buffer)).rejects.toThrow(/unsafe path/i);
  });
});
