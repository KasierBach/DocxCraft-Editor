import { describe, expect, it } from 'vitest';

import { resolveAppConfig } from '../config.ts';

describe('resolveAppConfig', () => {
  it('applies safe defaults and treats blank placeholders as unset', () => {
    const config = resolveAppConfig({ DATA_DIR: 'data/docs', AI_ENABLED: 'true', AI_API_KEY: '  ' });
    expect(config.documentStore).toBe('file');
    expect(config.dataDir).toBe('data/docs');
    expect(config.quotas).toEqual({ maxDocuments: 100, maxStorageBytes: 100 * 1024 * 1024 });
    expect(config.ai.enabled).toBe(false);
    expect(config.ai.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('resolves hosted Postgres, OAuth, AI, quotas, and error tracking settings', () => {
    const config = resolveAppConfig({
      DOCUMENT_STORE: 'postgres',
      DATABASE_URL: 'postgres://user:pass@localhost/db',
      APP_BASE_URL: 'https://editor.example.test',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      SESSION_TTL_DAYS: '7',
      MAX_DOCUMENTS_PER_USER: '5',
      MAX_STORAGE_BYTES_PER_USER: '2048',
      AI_ENABLED: 'true',
      AI_API_KEY: 'operator-key',
      AI_BASE_URL: 'https://ai.example.test/v1',
      AI_MODEL: 'small',
      AI_MAX_REQUESTS_PER_HOUR: '9',
      ERROR_TRACKING_URL: 'https://errors.example.test/ingest',
    });
    expect(config.documentStore).toBe('postgres');
    expect(config.auth.sessionTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(config.auth.google).toEqual({ clientId: 'google-id', clientSecret: 'google-secret' });
    expect(config.auth.github).toBeUndefined();
    expect(config.quotas).toEqual({ maxDocuments: 5, maxStorageBytes: 2048 });
    expect(config.ai).toMatchObject({ enabled: true, apiKey: 'operator-key', baseUrl: 'https://ai.example.test/v1', model: 'small', maxRequestsPerHour: 9 });
    expect(config.errorTrackingUrl).toBe('https://errors.example.test/ingest');
  });

  it('fails fast for invalid hosted database and invalid environment values', () => {
    expect(() => resolveAppConfig({ DOCUMENT_STORE: 'postgres' })).toThrow(/DATABASE_URL is required/);
    expect(() => resolveAppConfig({ APP_BASE_URL: 'not a URL' })).toThrow(/Invalid environment configuration/);
    expect(() => resolveAppConfig({ AI_MAX_REQUESTS_PER_HOUR: '0' })).toThrow(/AI_MAX_REQUESTS_PER_HOUR/);
  });
});
