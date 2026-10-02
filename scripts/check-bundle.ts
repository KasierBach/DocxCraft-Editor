import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { Manifest } from 'vite';

// Count the entry's static dependency graph, not editor chunks loaded on demand.
export function checkBundle(manifest: Manifest, readAsset: (file: string) => Buffer, budget = 200 * 1024) {
  const visited = new Set<string>();
  const files = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Build manifest is missing ${key}`);
    visited.add(key);
    if (chunk.file.endsWith('.js')) files.add(chunk.file);
    chunk.imports?.forEach(visit);
  };
  visit('index.html');
  const bytes = [...files].reduce((total, file) => total + gzipSync(readAsset(file)).length, 0);
  if (bytes > budget) {
    throw new Error(`Initial JavaScript ${bytes} bytes gzip exceeds the ${budget}-byte budget`);
  }
  return { bytes, files: [...files] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dist = resolve('dist');
  const manifest: Manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
  const result = checkBundle(manifest, (file) => readFileSync(resolve(dist, file)));
  console.log(`Initial JavaScript: ${(result.bytes / 1024).toFixed(2)} KiB gzip / 200 KiB (${result.files.length} files)`);
}
