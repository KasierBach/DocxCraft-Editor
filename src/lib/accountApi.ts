import { readErrorMessage, withRequestTimeout } from './documentApi';

const ACCOUNT_API_PATH = '/api/account';

export type AccountUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
};

export type AccountSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip: string | null;
  device: string;
  isCurrent: boolean;
};

/** `action` is a plain string: a future server action must not look known here. */
export type ActivityEvent = {
  id: string;
  action: string;
  documentId: string | null;
  createdAt: string;
};

export type ActivityPage = {
  events: ActivityEvent[];
  nextCursor: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ACCOUNT_API_PATH}${path}`, withRequestTimeout(init));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  // Revocations answer 204 with no body.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function updateDisplayName(displayName: string) {
  return request<AccountUser>('', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
}

export function listSessions() {
  return request<AccountSession[]>('/sessions');
}

export function revokeSession(sessionId: string) {
  return request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export function revokeOtherSessions() {
  return request<{ revoked: number }>('/sessions', { method: 'DELETE' });
}

export function listActivity(cursor?: string | null, limit?: number) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit !== undefined) params.set('limit', String(limit));

  const query = params.toString();
  return request<ActivityPage>(`/activity${query ? `?${query}` : ''}`);
}
