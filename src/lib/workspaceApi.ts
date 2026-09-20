import { readErrorMessage, withRequestTimeout } from './documentApi';

const WORKSPACE_PATH = '/api/workspace';

export type WorkspaceDocument = {
  id: string;
  name: string;
  folder: string | null;
  tags: string[];
  isStarred: boolean;
  updatedAt: string;
  sizeInBytes: number;
  role: string;
};

export type WorkspaceComment = {
  id: string;
  documentId: string;
  authorId: string;
  authorName: string;
  parentId: string | null;
  paraId: string | null;
  body: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${WORKSPACE_PATH}${path}`, withRequestTimeout(init));
  if (!response.ok) throw new Error(await readErrorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function rootRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, withRequestTimeout(init));
  if (!response.ok) throw new Error(await readErrorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listWorkspaceDocuments(query = '') {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
  return request<WorkspaceDocument[]>(`/documents${suffix}`);
}

export type WorkspaceUsage = {
  documents: number;
  bytes: number;
  limits: { maxDocuments: number; maxStorageBytes: number } | null;
};

export function getWorkspaceUsage() {
  return request<WorkspaceUsage>('/usage');
}

export function updateWorkspaceDocument(documentId: string, input: Partial<Pick<WorkspaceDocument, 'folder' | 'tags' | 'isStarred'>>) {
  return request<WorkspaceDocument>(`/documents/${encodeURIComponent(documentId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
}

export function bulkUpdateWorkspaceDocuments(documentIds: string[], input: { folder?: string | null; isStarred?: boolean }) {
  return request<{ updated: number }>('/documents/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documentIds, ...input }) });
}

export function importDocumentUrl(url: string) {
  return rootRequest<{ id: string; name: string }>('/api/documents/import-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export function listDocumentComments(documentId: string) {
  return request<WorkspaceComment[]>(`/documents/${encodeURIComponent(documentId)}/comments`);
}

export function addDocumentComment(documentId: string, body: { body: string; paraId?: string | null; parentId?: string | null }) {
  return request<WorkspaceComment>(`/documents/${encodeURIComponent(documentId)}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export function resolveDocumentComment(commentId: string, resolved: boolean) {
  return request<WorkspaceComment>(`/comments/${encodeURIComponent(commentId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolved }) });
}

export type DocumentShare = { id: string; email: string; role: string; createdAt: string };

export function listDocumentShares(documentId: string) {
  return request<DocumentShare[]>(`/documents/${encodeURIComponent(documentId)}/shares`);
}

export function upsertDocumentShare(documentId: string, email: string, role: 'viewer' | 'editor') {
  return request<DocumentShare>(`/documents/${encodeURIComponent(documentId)}/shares`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role }) });
}

export function deleteDocumentShare(documentId: string, shareId: string) {
  return request<void>(`/documents/${encodeURIComponent(documentId)}/shares/${encodeURIComponent(shareId)}`, { method: 'DELETE' });
}

export type ApiToken = { id: string; name: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null };

export function listApiTokens() {
  return rootRequest<ApiToken[]>('/api/account/tokens');
}

export function createApiToken(name: string) {
  return rootRequest<ApiToken & { token: string }>('/api/account/tokens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
}

export function revokeApiToken(tokenId: string) {
  return rootRequest<void>(`/api/account/tokens/${encodeURIComponent(tokenId)}`, { method: 'DELETE' });
}

export type WorkspaceNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export function listWorkspaceNotifications() {
  return request<WorkspaceNotification[]>('/notifications');
}

export function markWorkspaceNotificationsRead(ids?: string[]) {
  return request<void>('/notifications/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ids ? { ids } : {}),
  });
}

export type AiSettings = {
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string | null;
  keySource: string;
  apiKeyConfigured: boolean;
  usage: { requests: number; inputTokens: number; outputTokens: number; windowStarted: string };
  maxRequestsPerHour: number;
};

export function getAiSettings() {
  return rootRequest<AiSettings>('/api/ai/settings');
}

export function updateAiSettings(input: Partial<Pick<AiSettings, 'provider' | 'model' | 'baseUrl' | 'enabled'>>) {
  return rootRequest<Pick<AiSettings, 'provider' | 'model' | 'baseUrl' | 'enabled'>>('/api/ai/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
}

export type AiMessage = { role: 'user' | 'assistant'; content: string };

export async function streamAiChat(
  messages: AiMessage[],
  context: { selection?: string; paragraph?: string; documentName?: string } | undefined,
  onText: (text: string) => void,
) {
  const response = await fetch('/api/ai/chat', withRequestTimeout({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, context }) }, 120_000));
  if (!response.ok) throw new Error(await readErrorMessage(response));
  if (!response.body) throw new Error('The AI response stream is unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const consume = (line: string) => {
    if (!line.startsWith('data:')) return false;
    const payload = JSON.parse(line.slice(5).trim()) as { type: string; text?: string };
    if (payload.type === 'text' && payload.text) onText(payload.text);
    return payload.type === 'done';
  };
  while (true) {
    const chunk = await reader.read();
    pending += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (consume(line)) return;
    }
    if (chunk.done) {
      if (pending && consume(pending)) return;
      return;
    }
  }
}
