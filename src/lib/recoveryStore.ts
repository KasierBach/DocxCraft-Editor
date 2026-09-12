export type RecoverySourceKind = 'sample' | 'local-file' | 'saved-document';

export type RecoverySnapshot = {
  sourceKind: RecoverySourceKind;
  documentId: string | null;
  documentName: string;
  activeParaId: string | null;
  savedAt: string;
  buffer: ArrayBuffer;
};

type StoredRecoverySnapshot = RecoverySnapshot & {
  key: string;
};

type FallbackSnapshot = Omit<StoredRecoverySnapshot, 'buffer'> & {
  bufferBase64: string;
};

const DATABASE_NAME = 'docx-editor';
const STORE_NAME = 'recovery-snapshots';
const DATABASE_VERSION = 1;
const FALLBACK_STORAGE_KEY = 'docx-editor/recovery-snapshots';
const MAX_FALLBACK_SNAPSHOTS = 5;

function snapshotKey(snapshot: Pick<RecoverySnapshot, 'sourceKind' | 'documentId' | 'documentName'>) {
  return snapshot.documentId
    ? `saved-document:${snapshot.documentId}`
    : `${snapshot.sourceKind}:${snapshot.documentName}`;
}

function latestSnapshot(snapshots: RecoverySnapshot[]) {
  return snapshots.sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0] ?? null;
}

const BASE64_CHUNK_SIZE = 0x8000;

function encodeArrayBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }

  return window.btoa(binary);
}

function decodeArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function readFallbackSnapshots(): FallbackSnapshot[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeFallbackSnapshots(snapshots: FallbackSnapshot[]) {
  const ordered = [...snapshots].sort((left, right) => left.savedAt.localeCompare(right.savedAt));

  // Serialize each entry exactly once; retries then only re-join shorter
  // slices instead of re-serializing the full multi-megabyte payload.
  const serializedEntries = ordered.map((snapshot) => JSON.stringify(snapshot));

  // Storage can be full or unavailable (private mode). Drop the oldest
  // entries until the payload fits, and skip silently when it never does —
  // the IndexedDB path is the primary recovery mechanism.
  for (let count = Math.min(serializedEntries.length, MAX_FALLBACK_SNAPSHOTS); count > 0; count -= 1) {
    try {
      window.localStorage.setItem(FALLBACK_STORAGE_KEY, `[${serializedEntries.slice(-count).join(',')}]`);
      return;
    } catch {
      // Try again with fewer entries.
    }
  }
}

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openRecoveryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Recovery database failed to open.'));
    request.onblocked = () =>
      reject(new Error('Recovery database is blocked by another tab.'));
  });
}

export async function readRecoverySnapshot(): Promise<RecoverySnapshot | null> {
  if (typeof window === 'undefined') return null;

  if (!canUseIndexedDb()) {
    const snapshots = readFallbackSnapshots()
      .map(({ bufferBase64, key: _key, ...snapshot }) => {
        try {
          return { ...snapshot, buffer: decodeArrayBuffer(bufferBase64) };
        } catch {
          // Skip corrupt or legacy entries instead of failing the whole read.
          return null;
        }
      })
      .filter((snapshot): snapshot is RecoverySnapshot => snapshot !== null);
    return latestSnapshot(snapshots);
  }

  const database = await openRecoveryDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const stored = await requestResult<StoredRecoverySnapshot[]>(
      transaction.objectStore(STORE_NAME).getAll(),
    );
    await transactionComplete(transaction);
    return latestSnapshot(stored.map(({ key: _key, ...snapshot }) => snapshot));
  } finally {
    database.close();
  }
}

export async function saveRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
  if (typeof window === 'undefined') return;

  const key = snapshotKey(snapshot);
  if (!canUseIndexedDb()) {
    const next = readFallbackSnapshots().filter((stored) => stored.key !== key);
    next.push({ ...snapshot, key, bufferBase64: encodeArrayBuffer(snapshot.buffer) });
    writeFallbackSnapshots(next);
    return;
  }

  const database = await openRecoveryDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ ...snapshot, key } satisfies StoredRecoverySnapshot);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function clearRecoverySnapshot(
  snapshot?: Pick<RecoverySnapshot, 'sourceKind' | 'documentId' | 'documentName'>,
): Promise<void> {
  if (typeof window === 'undefined') return;

  if (!canUseIndexedDb()) {
    if (!snapshot) {
      window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
      return;
    }

    const key = snapshotKey(snapshot);
    writeFallbackSnapshots(readFallbackSnapshots().filter((stored) => stored.key !== key));
    return;
  }

  const database = await openRecoveryDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (snapshot) store.delete(snapshotKey(snapshot));
    else store.clear();
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}