import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDocumentStore } from '../documentStore.ts';
import {
  describeDocumentStoreContract,
  type StoreHarness,
} from './support/documentStoreContract.ts';

describeDocumentStoreContract('FileDocumentStore', async (): Promise<StoreHarness> => {
  const root = await mkdtemp(join(tmpdir(), 'docx-file-store-'));

  return {
    createStore: async (options) => createDocumentStore({ rootDirectory: root, ...options }),
    backdateDeletion: async (documentId, deletedAt) => {
      const indexPath = join(root, 'index.json');
      const index = JSON.parse(await readFile(indexPath, 'utf-8')) as {
        documents: Array<{ id: string; deletedAt: string | null }>;
      };
      const document = index.documents.find((entry) => entry.id === documentId);
      if (!document) throw new Error(`Document ${documentId} is not in the index.`);
      document.deletedAt = deletedAt.toISOString();
      await writeFile(indexPath, JSON.stringify(index, null, 2));
    },
    reset: async () => {
      await rm(root, { recursive: true, force: true });
      await mkdir(root, { recursive: true });
    },
    dispose: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
});
