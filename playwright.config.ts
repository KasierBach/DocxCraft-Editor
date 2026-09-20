import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // The editor and its local API share one browser-sized fixture. Running all
  // four projects in parallel exhausts the Windows/CI renderer budget and
  // creates false setup timeouts; keep the default deterministic and allow an
  // explicit override for larger runners.
  fullyParallel: false,
  workers: Math.max(1, Number(process.env.PW_WORKERS ?? '1') || 1),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5136',
    // Skip the first-run onboarding modal in every test context.
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
      // Tests exercise the app directly, so the API must never require auth.
      // Starting our own server also prevents silently reusing a claim-mode
      // dev server (stop `npm run dev` before running the suite).
      // DOCUMENT_STORE=file keeps e2e independent of Postgres and `.env`.
      env: { AUTH_MODE: 'off', DOCUMENT_STORE: 'file' },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:web -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5136',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
