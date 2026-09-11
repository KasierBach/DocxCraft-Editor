import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildDocumentApiApp } from './app.ts';
import { createDocumentStore } from './documentStore.ts';
import { createServerLoggerOptions } from './logger.ts';

export const DEFAULT_PORT = 4175;

function readPort(value: string | undefined) {
  if (!value) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

function readCorsOrigin() {
  const value = process.env.CORS_ORIGIN;
  if (!value) return undefined;
  if (value === '*') return true;
  if (value === 'false') return false;
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export async function startDocumentApiServer({
  port = DEFAULT_PORT,
  host = '127.0.0.1',
}: {
  port?: number;
  host?: string;
} = {}) {
  const store = createDocumentStore({
    rootDirectory: process.env.DATA_DIR ?? path.join(process.cwd(), 'data', 'documents'),
  });
  const app = buildDocumentApiApp({
    store,
    corsOrigin: readCorsOrigin(),
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
  startDocumentApiServer({
    port: readPort(process.env.PORT),
    host: process.env.HOST ?? '127.0.0.1',
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
