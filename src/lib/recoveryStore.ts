export type RecoverySourceKind = 'sample' | 'local-file' | 'saved-document';

export type RecoverySnapshot = {
  sourceKind: RecoverySourceKind;
  documentId: string | null;
  documentName: string;
  activeParaId: string | null;
  savedAt: string;
  buffer: ArrayBuffer;
};

type StoredRecoverySnapshot = Omit<RecoverySnapshot, 'buffer'> & {
  bufferBase64: string;
};

const RECOVERY_STORAGE_KEY = 'docx-editor/recovery-snapshot';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function encodeArrayBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

function decodeArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function readRecoverySnapshot() {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(RECOVERY_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const stored = JSON.parse(rawValue) as StoredRecoverySnapshot;
    if (!stored || typeof stored.bufferBase64 !== 'string') {
      return null;
    }

    return {
      sourceKind: stored.sourceKind,
      documentId: stored.documentId,
      documentName: stored.documentName,
      activeParaId: stored.activeParaId,
      savedAt: stored.savedAt,
      buffer: decodeArrayBuffer(stored.bufferBase64),
    } satisfies RecoverySnapshot;
  } catch {
    return null;
  }
}

export function saveRecoverySnapshot(snapshot: RecoverySnapshot) {
  if (!isBrowser()) {
    return;
  }

  const storedSnapshot: StoredRecoverySnapshot = {
    sourceKind: snapshot.sourceKind,
    documentId: snapshot.documentId,
    documentName: snapshot.documentName,
    activeParaId: snapshot.activeParaId,
    savedAt: snapshot.savedAt,
    bufferBase64: encodeArrayBuffer(snapshot.buffer),
  };

  window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(storedSnapshot));
}

export function clearRecoverySnapshot() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(RECOVERY_STORAGE_KEY);
}
