import path from 'node:path';

import { z } from 'zod';

const AppConfigSchema = z.object({
  DOCUMENT_STORE: z.enum(['file', 'postgres']).default('file'),
  DATABASE_URL: z.string().min(1).optional(),
  DATA_DIR: z.string().min(1).optional(),
  BLOB_DIR: z.string().min(1).optional(),
});

export type DocumentStoreDriver = 'file' | 'postgres';

export type AppConfig = {
  documentStore: DocumentStoreDriver;
  databaseUrl?: string;
  dataDir: string;
  blobDir: string;
};

/**
 * Resolves and validates the persistence configuration at boot. A bad value
 * fails fast here instead of surfacing on the first request.
 */
export function resolveAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = AppConfigSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const { DOCUMENT_STORE, DATABASE_URL, DATA_DIR, BLOB_DIR } = parsed.data;
  if (DOCUMENT_STORE === 'postgres' && !DATABASE_URL) {
    throw new Error(
      'Invalid environment configuration: DATABASE_URL is required when DOCUMENT_STORE=postgres.',
    );
  }

  const dataDir = DATA_DIR ?? path.join(process.cwd(), 'data', 'documents');
  return {
    documentStore: DOCUMENT_STORE,
    databaseUrl: DATABASE_URL,
    dataDir,
    blobDir: BLOB_DIR ?? path.join(path.dirname(dataDir), 'blobs'),
  };
}
