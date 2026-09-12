import type {
  SavedDocumentSummary,
  SavedDocumentVersionSummary,
} from '../../shared/types.js';

export type { SavedDocumentSummary, SavedDocumentVersionSummary };

type SaveDocumentInput = {
  id?: string;
  name: string;
  buffer: ArrayBuffer;
  revision?: number;
};

type ReadDocumentOptions = {
  markOpened?: boolean;
};

const DOCUMENTS_API_PATH = '/api/documents';
const REQUEST_TIMEOUT_MS = 30_000;

// Track pending requests to prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<unknown>>();

export function withRequestTimeout(init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): RequestInit {
  if (typeof AbortSignal.timeout !== 'function') {
    return init;
  }

  return { ...init, signal: AbortSignal.timeout(timeoutMs) };
}

function encodeDocumentNameHeader(name: string) {
  return encodeURIComponent(name);
}

function createContentUrl(documentId: string, options?: ReadDocumentOptions) {
  const params = new URLSearchParams();

  if (options?.markOpened !== undefined) {
    params.set('markOpened', options.markOpened ? 'true' : 'false');
  }

  const query = params.toString();
  return `${DOCUMENTS_API_PATH}/${documentId}/content${query ? `?${query}` : ''}`;
}

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}.`;

  try {
    const text = await response.text();
    if (!text) {
      return fallback;
    }

    try {
      const payload = JSON.parse(text) as { message?: unknown };
      return typeof payload.message === 'string' && payload.message ? payload.message : text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error('The server returned an unexpected response.', { cause: error });
  }
}

/**
 * Deduplicates concurrent requests to the same endpoint.
 * If a request to the same key is already pending, returns the existing promise.
 */
async function dedupeRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

export async function listDocuments() {
  return dedupeRequest('list-documents', async () => {
    const response = await fetch(DOCUMENTS_API_PATH, withRequestTimeout());
    return readJson<SavedDocumentSummary[]>(response);
  });
}

export async function listDocumentVersions(documentId: string) {
  return dedupeRequest(`list-versions-${documentId}`, async () => {
    const response = await fetch(
      `${DOCUMENTS_API_PATH}/${documentId}/versions`,
      withRequestTimeout(),
    );
    return readJson<SavedDocumentVersionSummary[]>(response);
  });
}

export async function saveDocument({ id, name, buffer, revision }: SaveDocumentInput) {
  const response = await fetch(id ? `${DOCUMENTS_API_PATH}/${id}` : DOCUMENTS_API_PATH, withRequestTimeout({
    method: id ? 'PUT' : 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-document-name': encodeDocumentNameHeader(name),
      ...(id && revision ? { 'if-match': `"${revision}"` } : {}),
    },
    body: buffer,
  }));

  return readJson<SavedDocumentSummary>(response);
}

export async function renameDocument(documentId: string, name: string) {
  const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}`, withRequestTimeout({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name }),
  }));

  return readJson<SavedDocumentSummary>(response);
}

export async function deleteDocument(documentId: string) {
  const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}`, withRequestTimeout({
    method: 'DELETE',
  }));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function readDocumentContent(documentId: string, options?: ReadDocumentOptions) {
  const markOpened = options?.markOpened === true ? 'opened' : 'plain';
  return dedupeRequest(`read-content-${documentId}-${markOpened}`, async () => {
    const response = await fetch(createContentUrl(documentId, options), withRequestTimeout());
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.arrayBuffer();
  });
}

export async function readDocumentVersionContent(documentId: string, versionId: string) {
  return dedupeRequest(`read-version-${documentId}-${versionId}`, async () => {
    const response = await fetch(
      `${DOCUMENTS_API_PATH}/${documentId}/versions/${versionId}/content`,
      withRequestTimeout(),
    );
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.arrayBuffer();
  });
}

export async function duplicateDocument(documentId: string) {
  const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}/duplicate`, withRequestTimeout({
    method: 'POST',
  }));

  return readJson<SavedDocumentSummary>(response);
}
