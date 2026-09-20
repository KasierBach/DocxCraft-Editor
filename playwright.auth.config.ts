import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const authDataRoot = mkdtempSync(path.join(os.tmpdir(), 'docxcraft-auth-e2e-'));
process.once('exit', () => rmSync(authDataRoot, { recursive: true, force: true }));

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/auth.passphrase.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-auth-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5136',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:5136',
          localStorage: [{ name: 'docxcraft:onboarded', value: 'done' }],
        },
      ],
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run server',
      url: 'http://127.0.0.1:4175/api/health',
      timeout: 30_000,
      env: {
        AUTH_MODE: 'claim',
        AUTH_PASSPHRASE: '',
        AUTH_PASSPHRASE_HASH: '',
        AUTH_STATE_FILE: path.join(authDataRoot, 'auth.json'),
        DATA_DIR: path.join(authDataRoot, 'documents'),
        DOCUMENT_STORE: 'file',
        HOST: '127.0.0.1',
        PORT: '4175',
      },
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5136',
      url: 'http://127.0.0.1:5136',
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
