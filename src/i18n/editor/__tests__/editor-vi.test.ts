import { describe, expect, it } from 'vitest';
import { en } from '@eigenpal/docx-editor-i18n';

import { editorVi } from '../vi';

function collectMissing(
  target: unknown,
  source: Record<string, unknown>,
  path: string,
  acc: string[],
) {
  for (const [key, value] of Object.entries(source)) {
    const next = `${path}${key}`;
    const candidate = (target as Record<string, unknown> | undefined)?.[key];

    if (typeof value === 'string') {
      if (typeof candidate !== 'string' || candidate.length === 0) {
        acc.push(next);
      }
    } else if (value && typeof value === 'object') {
      collectMissing(candidate, value as Record<string, unknown>, `${next}.`, acc);
    }
  }
}

describe('editor Vietnamese catalog', () => {
  it('translates every key the editor ships in English', () => {
    const missing: string[] = [];
    collectMissing(editorVi, en as unknown as Record<string, unknown>, '', missing);

    // `_lang` is the locale tag, not a user-facing string.
    expect(missing.filter((key) => key !== '_lang')).toEqual([]);
  });
});
