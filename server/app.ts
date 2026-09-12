import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';

import { DocumentConflictError, DocumentNotFoundError } from './documentStore.ts';
import { validateDocx } from './docxValidation.ts';
import type { DocumentStorePort } from './types.ts';

export const API_VERSION = '2026-05-25-fastify-ts';
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

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

const documentNameSchema = z.string().trim().min(1).max(255);

const renameDocumentBodySchema = z.object({
  name: documentNameSchema,
});

const documentContentQuerySchema = z.object({
  markOpened: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true'),
});

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
}: {
  store: DocumentStorePort;
  logger?: boolean | Record<string, unknown>;
  corsOrigin?: string | string[] | boolean;
  rateLimitMaxRequests?: number | false;
  rateLimitTimeWindowMs?: number;
  staticDir?: string;
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

    registerDocumentRoutes(scope, store);
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('x-request-id', request.id);
    if (!reply.hasHeader('content-security-policy')) {
      reply.header('content-security-policy', CSP_DIRECTIVES);
    }
  });

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_request, payload, done) => {
      done(null, payload);
    },
  );

  app.setErrorHandler((error, _request, reply) => {
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
    void reply.code(500).send({ message: 'Unexpected server error.' });
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    apiVersion: API_VERSION,
  }));

  app.get('/api/ready', async (_request, reply) => {
    try {
      await store.verifyIntegrity();
      return { status: 'ready', apiVersion: API_VERSION };
    } catch {
      return reply.code(503).send({ status: 'not_ready', apiVersion: API_VERSION });
    }
  });

  return app;
}

function registerDocumentRoutes(app: FastifyInstance, store: DocumentStorePort) {
  app.get('/api/documents', async () => store.listDocuments());

  app.get('/api/documents/:documentId/versions', async (request) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    return store.listDocumentVersions(documentId);
  });

  app.post('/api/documents', async (request, reply) => {
    const buffer = await readDocumentBuffer(request.body);
    const document = await store.saveNewDocument({
      name: readDocumentName(request.headers as Record<string, unknown>),
      buffer,
    });

    return reply.code(201).send(document);
  });

  app.put('/api/documents/:documentId', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const buffer = await readDocumentBuffer(request.body);
    const document = await store.updateDocument(documentId, {
      name: readDocumentName(request.headers as Record<string, unknown>),
      buffer,
      expectedRevision: readExpectedRevision(request.headers as Record<string, unknown>),
    });

    return reply.code(200).send(document);
  });

  app.patch('/api/documents/:documentId', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const body = parseWithSchema(renameDocumentBodySchema, request.body);
    const document = await store.renameDocument(documentId, { name: body.name });
    return reply.code(200).send(document);
  });

  app.delete('/api/documents/:documentId', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    await store.deleteDocument(documentId);
    return reply.code(204).send();
  });

  app.post('/api/documents/:documentId/duplicate', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const document = await store.duplicateDocument(documentId);
    return reply.code(201).send(document);
  });

  app.get('/api/documents/:documentId/content', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const query = parseWithSchema(documentContentQuerySchema, request.query);
    const document = await store.readDocumentRecord(documentId, {
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
    const { documentId, versionId } = parseWithSchema(documentVersionParamsSchema, request.params);
    const version = await store.readDocumentVersionRecord(documentId, versionId);

    reply.header(
      'content-type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    reply.header('content-length', version.buffer.byteLength.toString());
    reply.header('content-disposition', createContentDisposition(version.metadata.name));
    return reply.send(Buffer.from(version.buffer));
  });
}
