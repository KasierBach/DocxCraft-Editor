import { describe, expect, it } from 'vitest';

import { QuotaExceededError, assertWithinQuota } from '../quotas.ts';
import type { DocumentStorePort } from '../types.ts';

const limits = { maxDocuments: 2, maxStorageBytes: 100 };

function storeWith(documents: Array<{ sizeInBytes: number }>) {
  return {
    listDocuments: async () => documents,
  } as unknown as DocumentStorePort;
}

describe('assertWithinQuota', () => {
  it('allows a write under both limits', async () => {
    await expect(
      assertWithinQuota(storeWith([{ sizeInBytes: 10 }]), limits, 10, { countLimit: true }),
    ).resolves.toBeUndefined();
  });

  it('rejects when the document limit is reached', async () => {
    await expect(
      assertWithinQuota(storeWith([{ sizeInBytes: 1 }, { sizeInBytes: 1 }]), limits, 0, {
        countLimit: true,
      }),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('rejects when storage would overflow', async () => {
    await expect(
      assertWithinQuota(storeWith([{ sizeInBytes: 95 }]), limits, 10, { countLimit: true }),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('skips the count limit for updates', async () => {
    await expect(
      assertWithinQuota(storeWith([{ sizeInBytes: 1 }, { sizeInBytes: 1 }]), limits, 0, {
        countLimit: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when quotas are unset', async () => {
    await expect(
      assertWithinQuota(storeWith([{ sizeInBytes: 10_000 }]), undefined, 10_000, {
        countLimit: true,
      }),
    ).resolves.toBeUndefined();
  });
});
