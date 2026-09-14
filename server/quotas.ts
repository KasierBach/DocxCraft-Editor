import type { DocumentStorePort } from './types.ts';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export type QuotaLimits = {
  maxDocuments: number;
  maxStorageBytes: number;
};

/**
 * Enforces per-owner limits before a write. `extraBytes` is the size about to be
 * added; `countLimit` is skipped for updates, which replace rather than add a
 * document.
 */
export async function assertWithinQuota(
  store: DocumentStorePort,
  quotas: QuotaLimits | undefined,
  extraBytes: number,
  options: { countLimit: boolean },
) {
  if (!quotas) return;

  const documents = await store.listDocuments();
  if (options.countLimit && documents.length >= quotas.maxDocuments) {
    throw new QuotaExceededError(`Document limit reached (${quotas.maxDocuments}).`);
  }

  const usedBytes = documents.reduce((total, document) => total + document.sizeInBytes, 0);
  if (usedBytes + extraBytes > quotas.maxStorageBytes) {
    throw new QuotaExceededError('Storage limit reached.');
  }
}
