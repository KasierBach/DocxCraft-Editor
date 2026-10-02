import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { checkBundle } from '../check-bundle';

describe('initial JavaScript budget', () => {
  const manifest = {
    'index.html': { file: 'entry.js', isEntry: true, imports: ['shared'], dynamicImports: ['editor'] },
    shared: { file: 'shared.js', imports: ['index.html'] },
    editor: { file: 'editor.js' },
  };
  const assets: Record<string, Buffer> = {
    'entry.js': Buffer.from('public entry'),
    'shared.js': Buffer.from('shared runtime'),
  };

  it('counts static dependencies once and excludes lazy editor downloads', () => {
    const result = checkBundle(manifest, (file) => assets[file]);
    expect(result.files).toEqual(['entry.js', 'shared.js']);
    expect(result.bytes).toBe(gzipSync(assets['entry.js']).length + gzipSync(assets['shared.js']).length);
  });

  it('fails when compressed JavaScript exceeds the budget', () => {
    expect(() => checkBundle(manifest, (file) => assets[file], 1)).toThrow('exceeds');
  });

  it('accepts an exact budget boundary', () => {
    const bytes = checkBundle(manifest, (file) => assets[file]).bytes;
    expect(checkBundle(manifest, (file) => assets[file], bytes).bytes).toBe(bytes);
  });

  it('rejects incomplete build manifests instead of reporting a false zero', () => {
    expect(() => checkBundle({}, (file) => assets[file])).toThrow('index.html');
    expect(() => checkBundle({ 'index.html': { file: 'entry.js', imports: ['missing'] } },
      (file) => assets[file])).toThrow('missing');
  });
});
