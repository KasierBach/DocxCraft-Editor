import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadEnvFileIfPresent } from '../loadEnv.ts';

const PROCESS_KEY = `DOCXCRAFT_TEST_ENV_${process.pid}`;
const FILE_KEY = `${PROCESS_KEY}_FROM_FILE`;

afterEach(() => {
  delete process.env[PROCESS_KEY];
  delete process.env[FILE_KEY];
});

describe('loadEnvFileIfPresent', () => {
  it('ignores a missing env file', () => {
    expect(() => loadEnvFileIfPresent(path.join(os.tmpdir(), 'docxcraft-no-env-file'))).not.toThrow();
  });

  it('loads new values without overriding existing process values', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'docxcraft-env-'));
    const file = path.join(directory, '.env');
    process.env[PROCESS_KEY] = 'process-value';

    try {
      await writeFile(file, `${PROCESS_KEY}=file-value\n${FILE_KEY}=loaded-value\n`);
      loadEnvFileIfPresent(file);

      expect(process.env[PROCESS_KEY]).toBe('process-value');
      expect(process.env[FILE_KEY]).toBe('loaded-value');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
