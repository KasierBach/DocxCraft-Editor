import { readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type AuthStateStore = {
  read(): string | undefined;
  save(hash: string): Promise<void>;
};

type AuthStateFile = {
  passphraseHash?: string;
};

/**
 * File-backed passphrase store for the claim flow. The hash lives next to the
 * document data directory (e.g. data/auth.json), is written atomically, and
 * is cached in memory so auth checks stay allocation-free per request.
 */
export function createFileAuthStateStore({ filePath }: { filePath: string }): AuthStateStore {
  let cached: string | undefined | null = null;

  const load = (): string | undefined => {
    if (cached === null) {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as AuthStateFile;
        cached =
          typeof parsed.passphraseHash === 'string' && parsed.passphraseHash
            ? parsed.passphraseHash
            : undefined;
      } catch {
        cached = undefined;
      }
    }
    return cached ?? undefined;
  };

  return {
    read: load,
    async save(hash: string) {
      const contents = `${JSON.stringify({ passphraseHash: hash }, null, 2)}\n`;
      await writeFile(`${filePath}.tmp`, contents);
      await rename(`${filePath}.tmp`, filePath);
      cached = hash;
    },
  };
}

export function defaultAuthStateFilePath(dataDir: string) {
  return path.join(path.dirname(path.resolve(dataDir)), 'auth.json');
}
