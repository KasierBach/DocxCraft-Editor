import { existsSync } from 'node:fs';

/**
 * Loads a `.env` file into process.env when present, using Node's built-in
 * loader (no dependency). Existing environment variables win, so deployment
 * env always overrides the file. Safe to call when the file is absent.
 */
export function loadEnvFileIfPresent(path = '.env') {
  if (!existsSync(path)) return;
  process.loadEnvFile(path);
}
