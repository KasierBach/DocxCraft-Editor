import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7's env() does not read .env files, so load it explicitly (built-in
// Node loader, no dependency). Real environment variables take precedence.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/**
 * Prisma 7 centralizes the CLI configuration here (the datasource URL is no
 * longer allowed in schema.prisma). The runtime PrismaClient gets its
 * connection through the pg driver adapter instead — see storeFactory.ts.
 *
 * `datasource` is only attached when DATABASE_URL is present so commands that
 * do not connect (e.g. `prisma generate` from postinstall) work on a fresh clone.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
