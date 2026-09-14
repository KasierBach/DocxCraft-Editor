import path from 'node:path';

import { z } from 'zod';

const AppConfigSchema = z.object({
  DOCUMENT_STORE: z.enum(['file', 'postgres']).default('file'),
  DATABASE_URL: z.string().min(1).optional(),
  DATA_DIR: z.string().min(1).optional(),
  BLOB_DIR: z.string().min(1).optional(),
  APP_BASE_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().optional(),
  MAX_DOCUMENTS_PER_USER: z.coerce.number().int().positive().optional(),
  MAX_STORAGE_BYTES_PER_USER: z.coerce.number().int().positive().optional(),
});

export const DEFAULT_MAX_DOCUMENTS_PER_USER = 100;
export const DEFAULT_MAX_STORAGE_BYTES_PER_USER = 100 * 1024 * 1024;

export type DocumentStoreDriver = 'file' | 'postgres';

export type OAuthClientConfig = {
  clientId: string;
  clientSecret: string;
};

export type AuthConfig = {
  baseUrl?: string;
  sessionTtlMs: number;
  google?: OAuthClientConfig;
  github?: OAuthClientConfig;
};

export type AppConfig = {
  documentStore: DocumentStoreDriver;
  databaseUrl?: string;
  dataDir: string;
  blobDir: string;
  auth: AuthConfig;
  quotas: { maxDocuments: number; maxStorageBytes: number };
};

function readOAuthClient(
  clientId: string | undefined,
  clientSecret: string | undefined,
): OAuthClientConfig | undefined {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

/**
 * Resolves and validates the persistence configuration at boot. A bad value
 * fails fast here instead of surfacing on the first request.
 */
export function resolveAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Treat blank values as unset so an empty placeholder in .env (e.g. an
  // unfilled OAuth secret) does not fail validation.
  const populated = Object.fromEntries(
    Object.entries(env).filter(([, value]) => typeof value !== 'string' || value.trim() !== ''),
  );

  const parsed = AppConfigSchema.safeParse(populated);
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
    auth: {
      baseUrl: parsed.data.APP_BASE_URL,
      sessionTtlMs: (parsed.data.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
      google: readOAuthClient(parsed.data.GOOGLE_CLIENT_ID, parsed.data.GOOGLE_CLIENT_SECRET),
      github: readOAuthClient(parsed.data.GITHUB_CLIENT_ID, parsed.data.GITHUB_CLIENT_SECRET),
    },
    quotas: {
      maxDocuments: parsed.data.MAX_DOCUMENTS_PER_USER ?? DEFAULT_MAX_DOCUMENTS_PER_USER,
      maxStorageBytes:
        parsed.data.MAX_STORAGE_BYTES_PER_USER ?? DEFAULT_MAX_STORAGE_BYTES_PER_USER,
    },
  };
}
