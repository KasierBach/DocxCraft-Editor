import { describe, expect, it } from 'vitest';

import { DiskBlobStorage } from '../blobStorage.ts';
import { resolveAppConfig } from '../config.ts';
import { FileDocumentStore, createDocumentStore } from '../documentStore.ts';
import { PostgresDocumentStore } from '../postgresDocumentStore.ts';
import { createDocumentStoreFromConfig } from '../storeFactory.ts';

describe('createDocumentStoreFromConfig', () => {
  it('builds the file store with the configured data directory', () => {
    const config = resolveAppConfig({ DATA_DIR: 'data/test-documents' });
    const bundle = createDocumentStoreFromConfig(config);

    expect(bundle.store).toBeInstanceOf(FileDocumentStore);
    expect((bundle.store as FileDocumentStore).dataDir).toBe('data/test-documents');
    expect(bundle.prisma).toBeUndefined();
  });

  it('builds the Postgres store and shares its Prisma client', async () => {
    const config = resolveAppConfig({
      DOCUMENT_STORE: 'postgres',
      DATABASE_URL: 'postgres://docxcraft:docxcraft@127.0.0.1:5434/docxcraft_test',
      BLOB_DIR: 'data/test-blobs',
    });
    const bundle = createDocumentStoreFromConfig(config);

    try {
      expect(bundle.store).toBeInstanceOf(PostgresDocumentStore);
      expect(bundle.store).toHaveProperty('blobs', expect.any(DiskBlobStorage));
      expect(bundle.prisma).toBeDefined();
    } finally {
      await bundle.prisma?.$disconnect();
    }
  });

  it('rejects a Postgres config without a database URL', () => {
    const config = { ...resolveAppConfig({}), documentStore: 'postgres' as const, databaseUrl: undefined };

    expect(() => createDocumentStoreFromConfig(config)).toThrow(/DATABASE_URL is required/);
  });
});

describe('createDocumentStore', () => {
  it('rejects an empty storage directory', () => {
    expect(() => createDocumentStore({ rootDirectory: '  ' })).toThrow(
      /Document storage directory is required/,
    );
  });
});
