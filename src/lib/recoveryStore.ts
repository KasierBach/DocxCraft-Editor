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

function snapshotKey(snapshot: Pick<RecoverySnapshot, 'sourceKind' | 'documentId' | 'documentName'>) {
  return snapshot.documentId
    ? `saved-document:${snapshot.documentId}`
    : `${snapshot.sourceKind}:${snapshot.documentName}`;
}

function latestSnapshot(snapshots: RecoverySnapshot[]) {
  return snapshots.sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0] ?? null;
}

function encodeArrayBuffer(buffer: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
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
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(snapshots));
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
  });
}

export async function readRecoverySnapshot(): Promise<RecoverySnapshot | null> {
  if (typeof window === 'undefined') return null;

  if (!canUseIndexedDb()) {
    return latestSnapshot(
      readFallbackSnapshots().map(({ bufferBase64, key: _key, ...snapshot }) => ({
        ...snapshot,
        buffer: decodeArrayBuffer(bufferBase64),
      })),
    );
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