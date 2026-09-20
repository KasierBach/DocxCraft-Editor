import { afterEach, describe, expect, it, vi } from 'vitest';

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { resolveAuthPassphraseHash, resolveAuthState } from '../index.ts';
import { defaultAuthStateFilePath } from '../authStore.ts';

afterEach(() => vi.restoreAllMocks());

describe('resolveAuthPassphraseHash', () => {
  it('prefers a configured hash and treats blank values as absent', () => {
    expect(resolveAuthPassphraseHash({ AUTH_PASSPHRASE_HASH: '  scrypt:hash  ', AUTH_PASSPHRASE: 'ignored' })).toBe(
      'scrypt:hash',
    );
    expect(resolveAuthPassphraseHash({ AUTH_PASSPHRASE_HASH: '  ' })).toBeUndefined();
  });

  it('hashes a plaintext passphrase as a development fallback', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = resolveAuthPassphraseHash({ AUTH_PASSPHRASE: 'correct horse battery staple' });

    expect(result).toMatch(/^scrypt:[^:]+:[^:]+$/);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('AUTH_PASSPHRASE set in plaintext'));
  });
});

describe('resolveAuthState', () => {
  it('disables claiming unless AUTH_MODE is claim', () => {
    expect(resolveAuthState({}, 'data/documents')).toEqual({ allowAuthClaim: false });
  });

  it('creates a file-backed claim store with the default path', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'docxcraft-auth-'));
    const dataDir = path.join(directory, 'documents');
    const state = resolveAuthState({ AUTH_MODE: 'claim' }, dataDir);

    try {
      expect(state.allowAuthClaim).toBe(true);
      expect(state.authStateStore?.read()).toBeUndefined();
      await state.authStateStore?.save('scrypt:test');
      expect(state.authStateStore?.read()).toBe('scrypt:test');
      expect(defaultAuthStateFilePath(dataDir)).toBe(path.join(directory, 'auth.json'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('honors an explicit auth state file path', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'docxcraft-auth-'));
    const filePath = path.join(directory, 'custom-auth.json');
    const state = resolveAuthState({ AUTH_MODE: 'claim', AUTH_STATE_FILE: filePath }, 'data/documents');

    try {
      await state.authStateStore?.save('scrypt:custom');
      expect(state.authStateStore?.read()).toBe('scrypt:custom');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
