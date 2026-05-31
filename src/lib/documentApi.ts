import type {
  SavedDocumentSummary,
  SavedDocumentVersionSummary,
} from '../../shared/types.js';

export type { SavedDocumentSummary, SavedDocumentVersionSummary };

type SaveDocumentInput = {
  id?: string;
  name: string;
  buffer: ArrayBuffer;
};

type ReadDocumentOptions = {
  markOpened?: boolean;
};

const DOCUMENTS_API_PATH = '/api/documents';

// Track pending requests to prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<unknown>>();

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
  const text = await response.text();
  return text || `Request failed with status ${response.status}.`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
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
    const response = await fetch(DOCUMENTS_API_PATH);
    return readJson<SavedDocumentSummary[]>(response);
  });
}

export async function listDocumentVersions(documentId: string) {
  return dedupeRequest(`list-versions-${documentId}`, async () => {
    const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}/versions`);
    return readJson<SavedDocumentVersionSummary[]>(response);
  });
}

export async function saveDocument({ id, name, buffer }: SaveDocumentInput) {
  const response = await fetch(id ? `${DOCUMENTS_API_PATH}/${id}` : DOCUMENTS_API_PATH, {
    method: id ? 'PUT' : 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-document-name': encodeDocumentNameHeader(name),
    },
    body: buffer,
  });

  return readJson<SavedDocumentSummary>(response);
}

export async function renameDocument(documentId: string, name: string) {
  const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  return readJson<SavedDocumentSummary>(response);
}

export async function deleteDocument(documentId: string) {
  const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function readDocumentContent(documentId: string, options?: ReadDocumentOptions) {
  return dedupeRequest(`read-content-${documentId}`, async () => {
    const response = await fetch(createContentUrl(documentId, options));
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.arrayBuffer();
  });
}

export async function readDocumentVersionContent(documentId: string, versionId: string) {
  return dedupeRequest(`read-version-${documentId}-${versionId}`, async () => {
    const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}/versions/${versionId}/content`);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.arrayBuffer();
  });
}

export async function duplicateDocument(documentId: string) {
  const response = await fetch(`${DOCUMENTS_API_PATH}/${documentId}/duplicate`, {
    method: 'POST',
  });

  return readJson<SavedDocumentSummary>(response);
}
