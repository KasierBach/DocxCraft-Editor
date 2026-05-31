import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildDocumentApiApp } from './app.ts';
import { createDocumentStore } from './documentStore.ts';
import { createServerLoggerOptions } from './logger.ts';

export const DEFAULT_PORT = 4175;

export async function startDocumentApiServer({
  port = DEFAULT_PORT,
  host = '127.0.0.1',
}: {
  port?: number;
  host?: string;
} = {}) {
  const store = createDocumentStore({
    rootDirectory: path.join(process.cwd(), 'data', 'documents'),
  });
  const app = buildDocumentApiApp({
    store,
    logger: createServerLoggerOptions({
      env: process.env.NODE_ENV,
      level: process.env.LOG_LEVEL ?? 'info',
    }),
  });

  await app.listen({ port, host });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDocumentApiServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
