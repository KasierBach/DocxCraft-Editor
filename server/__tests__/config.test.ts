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

  it('reads OAuth clients, base URL, and session TTL', () => {
    const config = resolveAppConfig({
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      APP_BASE_URL: 'https://editor.example.com',
      SESSION_TTL_DAYS: '7',
    } as NodeJS.ProcessEnv);

    expect(config.auth.google).toEqual({ clientId: 'google-id', clientSecret: 'google-secret' });
    expect(config.auth.github).toBeUndefined();
    expect(config.auth.baseUrl).toBe('https://editor.example.com');
    expect(config.auth.sessionTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('ignores a half-configured OAuth client', () => {
    const config = resolveAppConfig({
      GITHUB_CLIENT_ID: 'github-id',
    } as NodeJS.ProcessEnv);

    expect(config.auth.github).toBeUndefined();
  });

  it('treats blank values as unset (empty .env placeholders)', () => {
    const config = resolveAppConfig({
      DOCUMENT_STORE: 'postgres',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      APP_BASE_URL: '',
    } as NodeJS.ProcessEnv);

    expect(config.documentStore).toBe('postgres');
    expect(config.auth.google).toBeUndefined();
    expect(config.auth.baseUrl).toBeUndefined();
  });
});
