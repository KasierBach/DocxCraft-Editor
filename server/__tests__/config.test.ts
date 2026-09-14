import { describe, expect, it } from 'vitest';

import { resolveAppConfig } from '../config.ts';

describe('resolveAppConfig', () => {
  it('defaults to the file store with derived paths', () => {
    const config = resolveAppConfig({} as NodeJS.ProcessEnv);

    expect(config.documentStore).toBe('file');
    expect(config.databaseUrl).toBeUndefined();
    expect(config.dataDir).toContain('documents');
    expect(config.blobDir.endsWith('blobs')).toBe(true);
  });

  it('requires DATABASE_URL when the postgres store is selected', () => {
    expect(() =>
      resolveAppConfig({ DOCUMENT_STORE: 'postgres' } as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL/);
  });

  it('accepts the postgres store when DATABASE_URL is set', () => {
    const config = resolveAppConfig({
      DOCUMENT_STORE: 'postgres',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    } as NodeJS.ProcessEnv);

    expect(config.documentStore).toBe('postgres');
  });

  it('rejects an unknown driver', () => {
    expect(() =>
      resolveAppConfig({ DOCUMENT_STORE: 'sqlite' } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid environment configuration/);
  });
});
