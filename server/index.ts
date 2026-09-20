import { pathToFileURL } from 'node:url';

import { buildDocumentApiApp } from './app.ts';
import { AccountService } from './accountService.ts';
import { hashPassphrase } from './auth.ts';
import { AuditService } from './audit.ts';
import { createOAuthProviders } from './auth/providers.ts';
import type { AccountsOptions } from './auth/routes.ts';
import { createFileAuthStateStore, defaultAuthStateFilePath, type AuthStateStore } from './authStore.ts';
import { resolveAppConfig, type AppConfig } from './config.ts';
import type { PrismaClient } from './generated/prisma/client.ts';
import { loadEnvFileIfPresent } from './loadEnv.ts';
import { createServerLoggerOptions } from './logger.ts';
import { SessionService } from './session.ts';
import { createDocumentStoreFromConfig } from './storeFactory.ts';
import { WorkspaceService } from './workspace.ts';

export const DEFAULT_PORT = 4175;

function readPort(value: string | undefined) {
  if (!value) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

/**
 * Resolves the auth configuration: AUTH_PASSPHRASE_HASH (scrypt:<salt>:<hash>)
 * takes precedence; AUTH_PASSPHRASE is hashed at boot as a convenience.
 */
export function resolveAuthPassphraseHash(env: NodeJS.ProcessEnv): string | undefined {
  const hash = env.AUTH_PASSPHRASE_HASH?.trim();
  if (hash) return hash;

  const passphrase = env.AUTH_PASSPHRASE?.trim();
  if (passphrase) {
    console.warn(
      'AUTH_PASSPHRASE set in plaintext; prefer AUTH_PASSPHRASE_HASH from `npm run hash-passphrase`.',
    );
    return hashPassphrase(passphrase);
  }

  return undefined;
}

/**
 * AUTH_MODE=claim lets the first visitor set the passphrase (instance
 * claiming) instead of configuring a hash up front; the hash persists in a
 * file next to the document data directory.
 */
export function resolveAuthState(env: NodeJS.ProcessEnv, dataDir: string): {
  authStateStore?: AuthStateStore;
  allowAuthClaim: boolean;
} {
  const allowAuthClaim = env.AUTH_MODE?.trim().toLowerCase() === 'claim';
  if (!allowAuthClaim) {
    return { allowAuthClaim: false };
  }

  const authStateFilePath = env.AUTH_STATE_FILE?.trim() || defaultAuthStateFilePath(dataDir);
  return {
    authStateStore: createFileAuthStateStore({ filePath: authStateFilePath }),
    allowAuthClaim: true,
  };
}

function readCorsOrigin() {
  const value = process.env.CORS_ORIGIN;
  if (!value) return undefined;
  if (value === '*') return true;
  if (value === 'false') return false;
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

/** Builds the hosted accounts wiring when a database and an OAuth provider exist. */
function buildAccountsOptions(
  config: AppConfig,
  prisma?: PrismaClient,
): AccountsOptions | undefined {
  const { google, github, baseUrl, sessionTtlMs } = config.auth;
  if (!prisma || !baseUrl || (!google && !github)) {
    return undefined;
  }

  return {
    accounts: new AccountService({ prisma }),
    sessions: new SessionService({ prisma, ttlMs: sessionTtlMs }),
    providers: createOAuthProviders({ google, github }),
    baseUrl,
    audit: new AuditService({ prisma }),
  };
}

export async function startDocumentApiServer({
  port = DEFAULT_PORT,
  host = '127.0.0.1',
}: {
  port?: number;
  host?: string;
} = {}) {
  const config = resolveAppConfig(process.env);
  const { store, prisma } = createDocumentStoreFromConfig(config);
  const accounts = buildAccountsOptions(config, prisma);
  const workspace = prisma ? new WorkspaceService({ prisma }) : undefined;
  const { authStateStore, allowAuthClaim } = resolveAuthState(process.env, config.dataDir);
  const app = buildDocumentApiApp({
    store,
    corsOrigin: readCorsOrigin(),
    authPassphraseHash: resolveAuthPassphraseHash(process.env),
    authStateStore,
    allowAuthClaim,
    accounts,
    workspace,
    ai: config.ai,
    errorTrackingUrl: config.errorTrackingUrl,
    quotas: config.quotas,
    logger: createServerLoggerOptions({
      env: process.env.NODE_ENV,
      level: process.env.LOG_LEVEL ?? 'info',
    }),
  });

  await app.listen({ port, host });

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFileIfPresent();
  startDocumentApiServer({
    port: readPort(process.env.PORT),
    host: process.env.HOST ?? '127.0.0.1',
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
