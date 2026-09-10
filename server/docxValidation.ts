import JSZip from 'jszip';

const REQUIRED_ENTRIES = ['[Content_Types].xml', 'word/document.xml'];
const MAX_ZIP_ENTRIES = 10_000;
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

type ZipData = { compressedSize?: number; uncompressedSize?: number };

export async function validateDocx(buffer: Uint8Array) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    throw new Error('Invalid DOCX archive.');
  }

  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) throw new Error('DOCX archive has too many entries.');
  if (entries.some((entry) => entry.name.split('/').includes('..'))) {
    throw new Error('DOCX archive contains an unsafe path.');
  }
  if (REQUIRED_ENTRIES.some((name) => !zip.file(name))) {
    throw new Error('DOCX archive is missing required files.');
  }

  let compressedBytes = 0;
  let uncompressedBytes = 0;
  for (const entry of entries) {
    const data = (entry as unknown as { _data?: ZipData })._data;
    compressedBytes += data?.compressedSize ?? 0;
    uncompressedBytes += data?.uncompressedSize ?? 0;
  }
  if (
    uncompressedBytes > MAX_UNCOMPRESSED_BYTES ||
    (compressedBytes > 0 && uncompressedBytes / compressedBytes > MAX_COMPRESSION_RATIO)
  ) {
    throw new Error('DOCX archive expands beyond the safe limit.');
  }
}
