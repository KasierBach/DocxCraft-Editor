// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { describe } from 'vitest';

import { DiskBlobStorage } from '../blobStorage.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PostgresDocumentStore } from '../postgresDocumentStore.ts';
import {
  describeDocumentStoreContract,
  type StoreHarness,
} from './support/documentStoreContract.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

// Skipped unless TEST_DATABASE_URL is set, and expects migrations to have been
// applied first (`npm run db:migrate`; CI does this before the suite).
describe.skipIf(!hasDatabase)('PostgresDocumentStore (integration)', () => {
  describeDocumentStoreContract('PostgresDocumentStore', async (): Promise<StoreHarness> => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the Postgres store contract.');
    }

    const releaseLock = await acquireDatabaseLock(databaseUrl);
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    const blobRoot = await mkdtemp(join(tmpdir(), 'docx-pg-blobs-'));
    const blobs = new DiskBlobStorage({ rootDir: blobRoot });

    return {
      createStore: async (options) => new PostgresDocumentStore({ prisma, blobs, ...options }),
      backdateDeletion: async (documentId, deletedAt) => {
        await prisma.document.update({ where: { id: documentId }, data: { deletedAt } });
      },
      reset: async () => {
        await prisma.$executeRawUnsafe(TRUNCATE);
        await rm(blobRoot, { recursive: true, force: true });
        await mkdir(blobRoot, { recursive: true });
      },
      dispose: async () => {
        await prisma.$disconnect();
        await rm(blobRoot, { recursive: true, force: true });
        await releaseLock();
      },
    };
  });
});
