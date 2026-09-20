import { existsSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';

import { DocumentConflictError, DocumentNotFoundError } from './documentStore.ts';
import { extractDocxText } from './docxText.ts';
import { reportServerError } from './errorTracking.ts';
import { validateDocx } from './docxValidation.ts';
import type { AuthStateStore } from './authStore.ts';
import {
  handleHostedSession,
  registerAccountDataRoutes,
  registerAccountProfileRoutes,
  registerAccountRoutes,
  type AccountsOptions,
} from './auth/routes.ts';
import { readCookies } from './cookies.ts';
import { QuotaExceededError, assertWithinQuota as checkQuota } from './quotas.ts';
import { SESSION_COOKIE_NAME } from './session.ts';
import type { DocumentStorePort } from './types.ts';
import { registerWorkspaceRoutes, type AiGatewayConfig } from './workspaceRoutes.ts';
import { WorkspaceError, type WorkspaceService } from './workspace.ts';
import {
  createClearCookie,
  createSessionCookie,
  createSessionToken,
  hashPassphrase,
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  readSessionCookie,
  verifyPassphrase,
  verifySessionToken,
} from './auth.ts';

export const API_VERSION = '2026-05-25-fastify-ts';
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const TRASH_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const IMPORT_FETCH_TIMEOUT_MS = 15_000;
const IMPORT_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'binary/octet-stream',
]);

// The app renders OOXML-derived DOM client-side, so the CSP is the backstop
// for any rendering-layer flaw. Styles must stay inline-allowed because React
// and the editor runtime apply inline styles; images arrive as data/blob URLs.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const documentIdParamsSchema = z.object({
  documentId: z.string().min(1),
});

const documentVersionParamsSchema = z.object({
  documentId: z.string().min(1),
  versionId: z.string().min(1),
});

const compareQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const documentNameSchema = z.string().trim().min(1).max(255);

const renameDocumentBodySchema = z.object({
  name: documentNameSchema,
});

const importUrlBodySchema = z.object({ url: z.string().url().max(2048) });

const documentContentQuerySchema = z.object({
  markOpened: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true'),
});

const loginBodySchema = z.object({
  passphrase: z.string().min(1).max(1024),
});

const setupBodySchema = z.object({
  passphrase: z.string().min(8).max(1024),
});

const PUBLIC_AUTH_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/setup',
]);
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

class RequestValidationError extends Error {
  constructor() {
    super('Request validation failed.');
  }
}

function readDocumentName(headers: Record<string, unknown>) {
  const headerValue = headers['x-document-name'];
  const rawValue = Array.isArray(headerValue) ? `${headerValue[0] ?? ''}` : `${headerValue ?? ''}`;

  try {
    return parseWithSchema(documentNameSchema, decodeURIComponent(rawValue));
  } catch {
    throw new RequestValidationError();
  }
}

async function readDocumentBuffer(body: unknown) {
  if (!(body instanceof Uint8Array) || body.byteLength < 4) {
    throw new RequestValidationError();
  }

  if (body[0] !== 0x50 || body[1] !== 0x4b || body[2] !== 0x03 || body[3] !== 0x04) {
    throw new RequestValidationError();
  }

  try {
    await validateDocx(body);
  } catch {
    throw new RequestValidationError();
  }
  return body;
}

function readExpectedRevision(headers: Record<string, unknown>) {
  const value = headers['if-match'];
  if (value === undefined) return undefined;
  const rawValue = Array.isArray(value) ? value[0] : value;
  const revision = Number(String(rawValue).replace(/^"|"$/g, ''));
  if (!Number.isInteger(revision) || revision < 1) throw new RequestValidationError();
  return revision;
}

function createAsciiFilenameFallback(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/["\\]/g, '_')
      .trim() || 'document.docx'
  );
}

function createContentDisposition(name: string) {
  const fallbackName = createAsciiFilenameFallback(name);
  const encodedName = encodeURIComponent(name);
  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new RequestValidationError();
  }

  return result.data;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasAllowedHostedOrigin(request: FastifyRequest, expectedOrigin: string) {
  const origin = firstHeader(request.headers.origin);
  const referer = firstHeader(request.headers.referer);
  if (!origin && !referer) return true;

  try {
    if (origin && new URL(origin).origin !== expectedOrigin) return false;
    if (referer && new URL(referer).origin !== expectedOrigin) return false;
    return true;
  } catch {
    return false;
  }
}

async function assertPublicImportUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new RequestValidationError();
    const addresses = await lookup(url.hostname, { all: true });
    if (
      addresses.some(({ address }) =>
        /^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(address) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
        address === '::1' ||
        address.startsWith('fc') ||
        address.startsWith('fd') ||
        address.startsWith('fe80:')
      )
    ) {
      throw new RequestValidationError();
    }
    return url;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError();
  }
}

function importedDocumentName(url: URL) {
  const lastSegment = decodeURIComponent(url.pathname.split('/').pop() ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  return (lastSegment || 'Imported document').slice(0, 255);
}

async function fetchImportedDocument(url: URL) {
  let currentUrl = url;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new RequestValidationError();
    }

    if (response.status < 300 || response.status >= 400) return { response, url: currentUrl };
    const location = response.headers.get('location');
    if (!location) throw new RequestValidationError();
    try {
      currentUrl = await assertPublicImportUrl(new URL(location, currentUrl).toString());
    } catch {
      throw new RequestValidationError();
    }
  }
  throw new RequestValidationError();
}

async function readImportedDocumentBody(response: Response) {
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType && !IMPORT_CONTENT_TYPES.has(contentType)) throw new RequestValidationError();

  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_DOCUMENT_BYTES) {
      throw new RequestValidationError();
    }
  }

  if (!response.body) throw new RequestValidationError();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        throw new RequestValidationError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

export const RATE_LIMIT_MAX_REQUESTS = 300;
export const RATE_LIMIT_TIME_WINDOW_MS = 60_000;

const DEFAULT_STATIC_DIR = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'dist',
);

export function buildDocumentApiApp({
  store,
  logger = false,
  corsOrigin,
  rateLimitMaxRequests = RATE_LIMIT_MAX_REQUESTS,
  rateLimitTimeWindowMs = RATE_LIMIT_TIME_WINDOW_MS,
  staticDir,
  authPassphraseHash,
  authStateStore,
  allowAuthClaim = false,
  accounts,
  workspace,
  ai,
  errorTrackingUrl,
  quotas,
}: {
  store: DocumentStorePort;
  logger?: boolean | Record<string, unknown>;
  corsOrigin?: string | string[] | boolean;
  rateLimitMaxRequests?: number | false;
  rateLimitTimeWindowMs?: number;
  staticDir?: string;
  authPassphraseHash?: string;
  authStateStore?: AuthStateStore;
  allowAuthClaim?: boolean;
  /** Hosted accounts (guest + OAuth). Omit for the self-host passphrase flow. */
  accounts?: AccountsOptions;
  workspace?: WorkspaceService;
  ai?: AiGatewayConfig;
  errorTrackingUrl?: string;
  /** Per-owner limits; only enforced when accounts are enabled. */
  quotas?: { maxDocuments: number; maxStorageBytes: number };
}): FastifyInstance {
  const app = Fastify({
    bodyLimit: MAX_DOCUMENT_BYTES,
    logger,
  });

  const resolvedStaticDir =
    staticDir === ''
      ? undefined
      : staticDir ?? (existsSync(DEFAULT_STATIC_DIR) ? DEFAULT_STATIC_DIR : undefined);

  if (resolvedStaticDir) {
    const hashedAssetsDirectory = path.join(resolvedStaticDir, 'assets');

    app.register(fastifyStatic, {
      root: resolvedStaticDir,
      prefix: '/',
      wildcard: false,
      maxAge: '30d',
      immutable: true,
      setHeaders: (res, pathName) => {
        if (pathName.endsWith('index.html')) {
          res.header('cache-control', 'no-cache');
          return;
        }

        // Only content-hashed bundles may cache immutably; unhashed files
        // from public/ must stay revalidatable so changes reach visitors.
        if (!pathName.startsWith(hashedAssetsDirectory)) {
          res.header('cache-control', 'public, max-age=300');
        }
      },
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        void reply.code(404).send({ message: 'Route not found.' });
        return;
      }

      // Missing bundles must fail loudly: serving index.html here turns a
      // stale deploy into a blank page with a 200 status.
      if (request.url.startsWith('/assets/')) {
        void reply.code(404).send({ message: 'Asset not found.' });
        return;
      }

      void reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_request, reply) => {
      void reply.code(404).send({ message: 'Route not found.' });
    });
  }

  const resolveAuthPassphraseHash = (): string | undefined =>
    authPassphraseHash ?? authStateStore?.read();
  const isAuthEnabled = Boolean(authPassphraseHash || allowAuthClaim || authStateStore);

  void app.register(async (scope) => {
    if (corsOrigin !== undefined) {
      await scope.register(cors, {
        origin: corsOrigin,
      });
    }

    if (rateLimitMaxRequests !== false) {
      await scope.register(rateLimit, {
        max: rateLimitMaxRequests,
        timeWindow: rateLimitTimeWindowMs,
      });
    }

    scope.get('/api/auth/session', async (request, reply) => {
      if (accounts) {
        return handleHostedSession(request, reply, accounts);
      }

      if (!isAuthEnabled) {
        return { authRequired: false, needsSetup: false, authenticated: true };
      }

      const currentHash = resolveAuthPassphraseHash();
      const needsSetup = allowAuthClaim && !currentHash;
      return {
        authRequired: true,
        needsSetup,
        authenticated:
          !needsSetup && currentHash
            ? verifySessionToken(
                readSessionCookie(request.headers as Record<string, unknown>),
                currentHash,
              )
            : false,
      };
    });

    if (isAuthEnabled && !accounts) {
      // Serialized so two racing visitors cannot both claim the instance.
      let claimTask: Promise<void> | null = null;

      scope.post(
        '/api/auth/login',
        {
          config: {
            rateLimit: {
              max: LOGIN_RATE_LIMIT_MAX,
              timeWindow: LOGIN_RATE_LIMIT_WINDOW_MS,
            },
          },
        },
        async (request, reply) => {
          const body = parseWithSchema(loginBodySchema, request.body);
          const currentHash = resolveAuthPassphraseHash();
          if (!currentHash) {
            return reply.code(409).send({ message: 'Setup required.' });
          }
          if (!verifyPassphrase(body.passphrase, currentHash)) {
            return reply.code(401).send({ message: 'Incorrect passphrase.' });
          }

          const token = createSessionToken(currentHash);
          reply.header(
            'set-cookie',
            createSessionCookie(token, request.headers as Record<string, unknown>),
          );
          return reply.code(204).send();
        },
      );

      scope.post('/api/auth/logout', async (_request, reply) => {
        reply.header('set-cookie', createClearCookie());
        return reply.code(204).send();
      });

      scope.post(
        '/api/auth/setup',
        {
          config: {
            rateLimit: {
              max: LOGIN_RATE_LIMIT_MAX,
              timeWindow: LOGIN_RATE_LIMIT_WINDOW_MS,
            },
          },
        },
        async (request, reply) => {
          if (!allowAuthClaim) {
            return reply.code(404).send({ message: 'Route not found.' });
          }

          const body = parseWithSchema(setupBodySchema, request.body);
          if (resolveAuthPassphraseHash()) {
            return reply.code(409).send({ message: 'This instance is already claimed.' });
          }
          if (!authStateStore) {
            return reply.code(500).send({ message: 'Auth state storage is unavailable.' });
          }

          const newHash = hashPassphrase(body.passphrase);
          const claim = async () => {
            await authStateStore.save(newHash);
          };
          claimTask = (claimTask ?? Promise.resolve()).then(claim, claim);

          try {
            await claimTask;
          } catch {
            return reply.code(500).send({ message: 'Failed to store the passphrase.' });
          } finally {
            claimTask = null;
          }

          const token = createSessionToken(newHash);
          reply.header(
            'set-cookie',
            createSessionCookie(token, request.headers as Record<string, unknown>),
          );
          return reply.code(204).send();
        },
      );

      // Fastify scope hooks apply to every route in the scope regardless of
      // registration order, so public auth routes are exempted explicitly.
      scope.addHook('preHandler', async (request, reply) => {
        if (PUBLIC_AUTH_ROUTES.has(request.routeOptions?.url ?? '')) {
          return;
        }

        const currentHash = resolveAuthPassphraseHash();
        const token = readSessionCookie(request.headers as Record<string, unknown>);
        if (!currentHash || !verifySessionToken(token, currentHash)) {
          return reply.code(401).send({ message: 'Authentication required.' });
        }
      });
    }

    if (accounts) {
      registerAccountRoutes(scope, accounts);
      registerAccountDataRoutes(scope, accounts);
      registerAccountProfileRoutes(scope, accounts);
      if (workspace) {
        registerWorkspaceRoutes(scope, {
          accounts,
          workspace,
          ai: ai ?? {
            enabled: false,
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            maxRequestsPerHour: 0,
          },
          audit: accounts.audit,
          quotas,
        });
      }
    }

    registerDocumentRoutes(scope, store, accounts, quotas);
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    reply.header('cross-origin-opener-policy', 'same-origin-allow-popups');
    reply.header('cross-origin-resource-policy', 'same-origin');
    reply.header('x-request-id', request.id);
    const forwardedProtocol = firstHeader(request.headers['x-forwarded-proto'])?.split(',')[0].trim();
    if (forwardedProtocol === 'https' || accounts?.baseUrl.startsWith('https:')) {
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    if (!reply.hasHeader('content-security-policy')) {
      reply.header('content-security-policy', CSP_DIRECTIVES);
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!accounts || !STATE_CHANGING_METHODS.has(request.method)) return;
    if (PUBLIC_AUTH_ROUTES.has(request.routeOptions?.url ?? '')) return;
    if (!readSessionCookie(request.headers as Record<string, unknown>)) return;

    // SameSite=Lax is required for OAuth callbacks; reject an explicitly
    // foreign Origin/Referer as defense-in-depth for hosted cookie mutations.
    if (!hasAllowedHostedOrigin(request, new URL(accounts.baseUrl).origin)) {
      return reply.code(403).send({ message: 'Request origin is not allowed.' });
    }
  });

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_request, payload, done) => {
      done(null, payload);
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof WorkspaceError) {
      void reply.code(error.statusCode).send({ message: error.message });
      return;
    }

    if (error instanceof QuotaExceededError) {
      void reply.code(413).send({ message: error.message });
      return;
    }

    if (error instanceof RequestValidationError) {
      void reply.code(400).send({ message: error.message });
      return;
    }

    if (error instanceof DocumentNotFoundError) {
      void reply.code(404).send({ message: 'Document not found.' });
      return;
    }

    const statusCode =
      typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    if (statusCode >= 400 && statusCode < 500) {
      void reply.code(statusCode).send({
        message: statusCode === 413 ? 'Document exceeds the 50 MiB upload limit.' : 'Request rejected.',
      });
      return;
    }

    if (error instanceof DocumentConflictError) {
      void reply.code(409).send({ message: error.message });
      return;
    }

    app.log.error(error);
    reportServerError(errorTrackingUrl, error, request.id);
    void reply.code(500).send({ message: 'Unexpected server error.' });
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    apiVersion: API_VERSION,
  }));

  app.get('/api/ready', async (_request, reply) => {
    try {
      if (store.checkReady) {
        await store.checkReady();
      } else {
        await store.verifyIntegrity();
      }
      return { status: 'ready', apiVersion: API_VERSION };
    } catch {
      return reply.code(503).send({ status: 'not_ready', apiVersion: API_VERSION });
    }
  });

  return app;
}

function registerDocumentRoutes(
  app: FastifyInstance,
  store: DocumentStorePort,
  accounts?: AccountsOptions,
  quotas?: { maxDocuments: number; maxStorageBytes: number },
) {
  // With hosted accounts every document call runs against a store scoped to the
  // session's user. Without an account layer (self-host) the base store is used
  // directly and behaviour is unchanged.
  const resolveScope = async (
    request: FastifyRequest,
    reply: FastifyReply,
    mode: 'read' | 'owner' | 'editor' = 'read',
  ) => {
    if (!accounts) return { store, userId: null as string | null };

    const session = await accounts.sessions.resolve(
      readCookies(request.headers.cookie)[SESSION_COOKIE_NAME],
    );
    if (!session) {
      void reply.code(401).send({ message: 'A session is required.' });
      return null;
    }

    const scopedStore =
      mode === 'read' && session.user.email && store.forAccess
        ? store.forAccess(session.user.id, session.user.email)
        : mode === 'editor' && session.user.email && store.forEditor
          ? store.forEditor(session.user.id, session.user.email)
          : store.forOwner(session.user.id);
    return { store: scopedStore, userId: session.user.id };
  };

  const assertWithinQuota = (
    scoped: DocumentStorePort,
    extraBytes: number,
    options: { countLimit: boolean },
  ) => checkQuota(scoped, quotas, extraBytes, options);

  app.get('/api/documents', async (request, reply) => {
    const scope = await resolveScope(request, reply);
    return scope ? scope.store.listDocuments() : reply;
  });

  app.get('/api/documents/trash', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'owner');
    if (!scope) return reply;
    // Lazy sweep on read: expiry needs no scheduler, cron or extra
    // infrastructure, which is what a self-hoster can actually run.
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * MS_PER_DAY);
    await scope.store.purgeExpiredDocuments(cutoff);
    return scope.store.listDeletedDocuments();
  });

  app.get('/api/documents/:documentId/versions', async (request, reply) => {
    const scope = await resolveScope(request, reply);
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    return scope.store.listDocumentVersions(documentId);
  });

  app.post('/api/documents', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'owner');
    if (!scope) return reply;
    const buffer = await readDocumentBuffer(request.body);
    await assertWithinQuota(scope.store, buffer.byteLength, { countLimit: true });
    const document = await scope.store.saveNewDocument({
      name: readDocumentName(request.headers as Record<string, unknown>),
      buffer,
    });
    await accounts?.audit?.record({
      action: 'document.create',
      actorUserId: scope.userId,
      documentId: document.id,
      ip: request.ip,
    });

    return reply.code(201).send(document);
  });

  app.post('/api/documents/import-url', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'owner');
    if (!scope) return reply;
    const url = await assertPublicImportUrl(parseWithSchema(importUrlBodySchema, request.body).url);
    const { response, url: resolvedUrl } = await fetchImportedDocument(url);
    if (!response.ok) throw new RequestValidationError();
    const buffer = await readImportedDocumentBody(response);
    const validated = await readDocumentBuffer(buffer);
    await assertWithinQuota(scope.store, validated.byteLength, { countLimit: true });
    const document = await scope.store.saveNewDocument({ name: importedDocumentName(resolvedUrl), buffer: validated });
    await accounts?.audit?.record({ action: 'document.create', actorUserId: scope.userId, documentId: document.id, ip: request.ip });
    return reply.code(201).send(document);
  });

  app.put('/api/documents/:documentId', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'editor');
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const buffer = await readDocumentBuffer(request.body);
    await assertWithinQuota(scope.store, buffer.byteLength, { countLimit: false });
    const document = await scope.store.updateDocument(documentId, {
      name: readDocumentName(request.headers as Record<string, unknown>),
      buffer,
      expectedRevision: readExpectedRevision(request.headers as Record<string, unknown>),
    });
    await accounts?.audit?.record({
      action: 'document.update',
      actorUserId: scope.userId,
      documentId,
      ip: request.ip,
    });

    return reply.code(200).send(document);
  });

  app.patch('/api/documents/:documentId', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'editor');
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const body = parseWithSchema(renameDocumentBodySchema, request.body);
    let previousName: string | null = null;
    const document = await scope.store.renameDocument(documentId, {
      name: body.name,
      onPreviousName: (name) => {
        previousName = name;
      },
    });
    await accounts?.audit?.record({
      action: 'document.rename',
      actorUserId: scope.userId,
      documentId,
      ip: request.ip,
      ...(previousName ? { metadata: { previousName, newName: document.name } } : {}),
    });
    return reply.code(200).send(document);
  });

  app.delete('/api/documents/:documentId', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'owner');
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    await scope.store.deleteDocument(documentId);
    await accounts?.audit?.record({
      action: 'document.delete',
      actorUserId: scope.userId,
      documentId,
      ip: request.ip,
    });
    return reply.code(204).send();
  });

  app.post('/api/documents/:documentId/restore', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'owner');
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const document = await scope.store.restoreDocument(documentId);
    await accounts?.audit?.record({
      action: 'document.restore',
      actorUserId: scope.userId,
      documentId,
      ip: request.ip,
    });
    return reply.code(200).send(document);
  });

  app.delete('/api/documents/:documentId/purge', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'owner');
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    await scope.store.purgeDocument(documentId);
    await accounts?.audit?.record({
      action: 'document.purge',
      actorUserId: scope.userId,
      documentId,
      ip: request.ip,
    });
    return reply.code(204).send();
  });

  app.post('/api/documents/:documentId/duplicate', async (request, reply) => {
    const scope = await resolveScope(request, reply, 'editor');
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    await assertWithinQuota(scope.store, 0, { countLimit: true });
    const document = await scope.store.duplicateDocument(documentId);
    await accounts?.audit?.record({
      action: 'document.duplicate',
      actorUserId: scope.userId,
      documentId,
      ip: request.ip,
    });
    return reply.code(201).send(document);
  });

  app.get('/api/documents/:documentId/content', async (request, reply) => {
    const scope = await resolveScope(request, reply);
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const query = parseWithSchema(documentContentQuerySchema, request.query);
    const document = await scope.store.readDocumentRecord(documentId, {
      markOpened: query.markOpened,
    });

    reply.header(
      'content-type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    reply.header('content-length', document.buffer.byteLength.toString());
    reply.header('content-disposition', createContentDisposition(document.metadata.name));
    return reply.send(Buffer.from(document.buffer));
  });

  app.get('/api/documents/:documentId/versions/:versionId/content', async (request, reply) => {
    const scope = await resolveScope(request, reply);
    if (!scope) return reply;
    const { documentId, versionId } = parseWithSchema(documentVersionParamsSchema, request.params);
    const version = await scope.store.readDocumentVersionRecord(documentId, versionId);

    reply.header(
      'content-type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    reply.header('content-length', version.buffer.byteLength.toString());
    reply.header('content-disposition', createContentDisposition(version.metadata.name));
    return reply.send(Buffer.from(version.buffer));
  });

  app.get('/api/documents/:documentId/compare', async (request, reply) => {
    const scope = await resolveScope(request, reply);
    if (!scope) return reply;
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const query = parseWithSchema(compareQuerySchema, request.query);
    const [from, to] = await Promise.all([
      scope.store.readDocumentVersionRecord(documentId, query.from),
      scope.store.readDocumentVersionRecord(documentId, query.to),
    ]);
    // ponytail: line-set diff keeps comparisons dependency-free; add word-level
    // hunks when reviewers need inline fidelity.
    const fromLines = (await extractDocxText(from.buffer)).split(/\r?\n/).filter(Boolean);
    const toLines = (await extractDocxText(to.buffer)).split(/\r?\n/).filter(Boolean);
    const fromSet = new Set(fromLines);
    const toSet = new Set(toLines);
    return {
      from: from.metadata,
      to: to.metadata,
      added: toLines.filter((line) => !fromSet.has(line)),
      removed: fromLines.filter((line) => !toSet.has(line)),
    };
  });
}
