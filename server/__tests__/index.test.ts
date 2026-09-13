import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { resolveAuthPassphraseHash, resolveAuthState } from '../index.ts';

const DATA_DIR = path.join('tmp', 'docx-data', 'documents');

describe('resolveAuthPassphraseHash', () => {
  it('prefers an explicit hash over a plaintext passphrase', () => {
    const hash = resolveAuthPassphraseHash({
      AUTH_PASSPHRASE_HASH: 'scrypt:salt:hash',
      AUTH_PASSPHRASE: 'ignored',
    });

    expect(hash).toBe('scrypt:salt:hash');
  });

  it('hashes a plaintext passphrase with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const hash = resolveAuthPassphraseHash({ AUTH_PASSPHRASE: 'my-passphrase' });

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns undefined when auth is not configured', () => {
    expect(resolveAuthPassphraseHash({})).toBe(undefined);
    expect(resolveAuthPassphraseHash({ AUTH_PASSPHRASE: '   ' })).toBe(undefined);
  });
});

describe('resolveAuthState', () => {
  it('enables claiming with a file-backed store in claim mode', () => {
    const state = resolveAuthState({ AUTH_MODE: 'claim' }, DATA_DIR);

    expect(state.allowAuthClaim).toBe(true);
    expect(state.authStateStore).toBeDefined();
    expect(state.authStateStore?.read()).toBe(undefined);
  });

  it('honours an explicit auth state file path', () => {
    const state = resolveAuthState(
      { AUTH_MODE: 'CLAIM', AUTH_STATE_FILE: path.join('tmp', 'custom-auth.json') },
      DATA_DIR,
    );

    expect(state.allowAuthClaim).toBe(true);
    expect(state.authStateStore).toBeDefined();
  });

  it('stays off for other or missing modes', () => {
    for (const env of [{}, { AUTH_MODE: 'off' }, { AUTH_MODE: 'passphrase' }]) {
      const state = resolveAuthState(env, DATA_DIR);
      expect(state.allowAuthClaim).toBe(false);
      expect(state.authStateStore).toBe(undefined);
    }
  });
});
