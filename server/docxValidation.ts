import JSZip from 'jszip';

const REQUIRED_ENTRIES = ['[Content_Types].xml', 'word/document.xml'];
const MAX_ZIP_ENTRIES = 10_000;
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY_SIGNATURE = 0x02014b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;
const CENTRAL_DIRECTORY_ENTRY_LENGTH = 46;
const ZIP64_LOCATOR_LENGTH = 20;
const STORED_COMPRESSION_METHOD = 0;
const UINT32_MAX = 0xffffffff;
const UINT16_MAX = 0xffff;

type ZipEntrySummary = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
};

/**
 * Reads the ZIP central directory without decompressing anything. Every size
 * check in `validateDocx` runs on these header values so that oversized or
 * compressed-bomb archives are rejected before JSZip decompresses them.
 */
function readZipEntrySummaries(buffer: Uint8Array): ZipEntrySummary[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(view);

  if (
    endOfCentralDirectoryOffset >= ZIP64_LOCATOR_LENGTH &&
    view.getUint32(endOfCentralDirectoryOffset - ZIP64_LOCATOR_LENGTH, true) ===
      ZIP64_LOCATOR_SIGNATURE
  ) {
    throw new Error('DOCX archive uses unsupported ZIP64 extensions.');
  }

  const entryCount = view.getUint16(endOfCentralDirectoryOffset + 10, true);
  const directorySize = view.getUint32(endOfCentralDirectoryOffset + 12, true);
  const directoryOffset = view.getUint32(endOfCentralDirectoryOffset + 16, true);

  if (
    entryCount === UINT16_MAX ||
    directorySize === UINT32_MAX ||
    directoryOffset === UINT32_MAX
  ) {
    throw new Error('DOCX archive uses unsupported ZIP64 extensions.');
  }

  if (
    directoryOffset + directorySize > view.byteLength ||
    directoryOffset + CENTRAL_DIRECTORY_ENTRY_LENGTH > view.byteLength
  ) {
    throw new Error('Invalid DOCX archive.');
  }

  return readCentralDirectoryEntries(view, directoryOffset, entryCount);
}

function findEndOfCentralDirectory(view: DataView) {
  const lastPossibleOffset = view.byteLength - END_OF_CENTRAL_DIRECTORY_LENGTH;
  const firstPossibleOffset = Math.max(
    0,
    view.byteLength - (END_OF_CENTRAL_DIRECTORY_LENGTH + MAX_ZIP_COMMENT_LENGTH),
  );

  for (let offset = lastPossibleOffset; offset >= firstPossibleOffset; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error('Invalid DOCX archive.');
}

function readCentralDirectoryEntries(view: DataView, offset: number, entryCount: number) {
  const decoder = new TextDecoder();
  const entries: ZipEntrySummary[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + CENTRAL_DIRECTORY_ENTRY_LENGTH > view.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY_SIGNATURE
    ) {
      throw new Error('Invalid DOCX archive.');
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + CENTRAL_DIRECTORY_ENTRY_LENGTH;

    if (nameStart + nameLength > view.byteLength) {
      throw new Error('Invalid DOCX archive.');
    }

    if (compressedSize === UINT32_MAX || uncompressedSize === UINT32_MAX) {
      throw new Error('DOCX archive uses unsupported ZIP64 extensions.');
    }

    entries.push({
      name: decoder.decode(
        new Uint8Array(view.buffer, view.byteOffset + nameStart, nameLength),
      ),
      method,
      compressedSize,
      uncompressedSize,
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

export async function validateDocx(buffer: Uint8Array) {
  const entries = readZipEntrySummaries(buffer);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error('DOCX archive has too many entries.');
  }
  if (entries.some((entry) => entry.name.split('/').includes('..'))) {
    throw new Error('DOCX archive contains an unsafe path.');
  }
  if (REQUIRED_ENTRIES.some((name) => !entries.some((entry) => entry.name === name))) {
    throw new Error('DOCX archive is missing required files.');
  }

  let compressedBytes = 0;
  let uncompressedBytes = 0;
  for (const entry of entries) {
    compressedBytes += entry.compressedSize;
    uncompressedBytes += entry.uncompressedSize;

    if (
      entry.method !== STORED_COMPRESSION_METHOD &&
      entry.compressedSize > 0 &&
      entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO
    ) {
      throw new Error('DOCX archive expands beyond the safe limit.');
    }
  }

  if (
    uncompressedBytes > MAX_UNCOMPRESSED_BYTES ||
    (compressedBytes > 0 && uncompressedBytes / compressedBytes > MAX_COMPRESSION_RATIO)
  ) {
    throw new Error('DOCX archive expands beyond the safe limit.');
  }

  try {
    await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    throw new Error('Invalid DOCX archive.');
  }
}
