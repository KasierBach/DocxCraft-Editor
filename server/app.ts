import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import { DocumentService } from './documentService.ts';
import type { DocumentStorePort } from './types.ts';

export const API_VERSION = '2026-05-25-fastify-ts';

const documentIdParamsSchema = z.object({
  documentId: z.string().min(1),
});

const documentVersionParamsSchema = z.object({
  documentId: z.string().min(1),
  versionId: z.string().min(1),
});

const renameDocumentBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
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

  if (!rawValue) {
    return '';
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
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

function isMissingDocumentError(error: unknown): error is Error {
  return error instanceof Error && /not found/i.test(error.message);
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new RequestValidationError();
  }

  return result.data;
}

export function buildDocumentApiApp({
  store,
  logger = false,
}: {
  store: DocumentStorePort;
  logger?: boolean | Record<string, unknown>;
}): FastifyInstance {
  const app = Fastify({
    logger,
  });
  const service = new DocumentService(store);

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_request, payload, done) => {
      done(null, payload);
    },
  );

  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).type('text/plain; charset=utf-8').send('Route not found.');
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RequestValidationError) {
      void reply.code(400).send({
        message: error.message,
      });
      return;
    }

    if (isMissingDocumentError(error)) {
      void reply.code(404).type('text/plain; charset=utf-8').send(error.message);
      return;
    }

    app.log.error(error);
    void reply
      .code(500)
      .type('text/plain; charset=utf-8')
      .send(error instanceof Error ? error.message : 'Unexpected server error.');
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    apiVersion: API_VERSION,
  }));

  app.get('/api/documents', async () => service.listDocuments());

  app.get('/api/documents/:documentId/versions', async (request) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    return service.listDocumentVersions(documentId);
  });

  app.post('/api/documents', async (request, reply) => {
    const buffer = request.body instanceof Uint8Array ? request.body : Buffer.alloc(0);
    const document = await service.createDocument({
      name: readDocumentName(request.headers as Record<string, unknown>),
      buffer,
    });

    return reply.code(201).send(document);
  });

  app.put('/api/documents/:documentId', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const buffer = request.body instanceof Uint8Array ? request.body : Buffer.alloc(0);
    const document = await service.updateDocument(documentId, {
      name: readDocumentName(request.headers as Record<string, unknown>),
      buffer,
    });

    return reply.code(200).send(document);
  });

  app.patch('/api/documents/:documentId', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const body = parseWithSchema(renameDocumentBodySchema, request.body);
    const document = await service.renameDocument(documentId, {
      name: body.name,
    });

    return reply.code(200).send(document);
  });

  app.delete('/api/documents/:documentId', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    await service.deleteDocument(documentId);
    return reply.code(204).send();
  });

  app.post('/api/documents/:documentId/duplicate', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const document = await service.duplicateDocument(documentId);
    return reply.code(201).send(document);
  });

  app.get('/api/documents/:documentId/content', async (request, reply) => {
    const { documentId } = parseWithSchema(documentIdParamsSchema, request.params);
    const query = parseWithSchema(documentContentQuerySchema, request.query);
    const document = await service.readDocumentContent(documentId, {
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
    const version = await service.readDocumentVersionContent(documentId, versionId);

    reply.header(
      'content-type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    reply.header('content-length', version.buffer.byteLength.toString());
    reply.header('content-disposition', createContentDisposition(version.metadata.name));

    return reply.send(Buffer.from(version.buffer));
  });

  return app;
}
