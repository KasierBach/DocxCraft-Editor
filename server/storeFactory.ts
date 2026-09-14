import { PrismaPg } from '@prisma/adapter-pg';

import { DiskBlobStorage } from './blobStorage.ts';
import type { AppConfig } from './config.ts';
import { createDocumentStore } from './documentStore.ts';
import { PrismaClient } from './generated/prisma/client.ts';
import { PostgresDocumentStore } from './postgresDocumentStore.ts';
import type { DocumentStorePort } from './types.ts';

/** Builds the document store selected by configuration. */
export function createDocumentStoreFromConfig(config: AppConfig): DocumentStorePort {
  if (config.documentStore === 'postgres') {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required for the postgres document store.');
    }

    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.databaseUrl }),
    });

    return new PostgresDocumentStore({
      prisma,
      blobs: new DiskBlobStorage({ rootDir: config.blobDir }),
    });
  }

  return createDocumentStore({ rootDirectory: config.dataDir });
}
