// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createSpawnSpec, getApiStatus, isApiReachable } from './devLauncher.ts';

describe('createSpawnSpec', () => {
  it('uses cmd.exe on Windows', () => {
    expect(createSpawnSpec('win32', 'dev:api')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm run dev:api'],
    });
  });

  it('uses npm directly on non-Windows platforms', () => {
    expect(createSpawnSpec('linux', 'dev:web')).toEqual({
      command: 'npm',
      args: ['run', 'dev:web'],
    });
  });
});

describe('isApiReachable', () => {
  it('returns true when the API health check succeeds', async () => {
    const fetchStub = async () => new Response('[]', { status: 200 });

    await expect(isApiReachable(fetchStub, 'http://127.0.0.1:4175/api/documents')).resolves.toBe(
      true,
    );
  });

  it('returns false when the API health check fails', async () => {
    const fetchStub = async () => {
      throw new Error('connect ECONNREFUSED');
    };

    await expect(isApiReachable(fetchStub, 'http://127.0.0.1:4175/api/documents')).resolves.toBe(
      false,
    );
  });
});

describe('getApiStatus', () => {
  it('reports a compatible API when the health payload matches', async () => {
    const fetchStub = async () =>
      new Response(
        JSON.stringify({
          status: 'ok',
          apiVersion: '2026-05-25-fastify-ts',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    await expect(
      getApiStatus(fetchStub, 'http://127.0.0.1:4175/api/health', '2026-05-25-fastify-ts'),
    ).resolves.toEqual({
      reachable: true,
      compatible: true,
      apiVersion: '2026-05-25-fastify-ts',
    });
  });

  it('reports an incompatible API when the health payload is stale', async () => {
    const fetchStub = async () =>
      new Response(
        JSON.stringify({
          status: 'ok',
          apiVersion: '2026-05-25-open-save',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    await expect(
      getApiStatus(fetchStub, 'http://127.0.0.1:4175/api/health', '2026-05-25-fastify-ts'),
    ).resolves.toEqual({
      reachable: true,
      compatible: false,
      apiVersion: '2026-05-25-open-save',
    });
  });
});
