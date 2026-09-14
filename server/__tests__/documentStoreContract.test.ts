import { mkdir, mkdtemp, rm } from 'node:fs/promises';
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
    reset: async () => {
      await rm(root, { recursive: true, force: true });
      await mkdir(root, { recursive: true });
    },
    dispose: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
});
