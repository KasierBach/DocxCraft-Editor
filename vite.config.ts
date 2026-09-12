import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5136,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4175',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    testTimeout: 15000,
    // The default pools (threads/forks) fail to inject the test context in
    // this workspace because the directory name contains a space ("Docx
    // Editor"); vmThreads keeps the runner functional.
    pool: 'vmThreads',
    maxWorkers: 2,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '.kilo/**'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 58 },
    },
  },
});
