import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  COMPACT_LAYOUT_BREAKPOINT_PX,
  COMPACT_LAYOUT_MEDIA_QUERY,
} from './layoutConstants';

const stylesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'styles',
);

function readStyleSheet(fileName: string) {
  return readFileSync(path.join(stylesDirectory, fileName), 'utf8');
}

describe('layoutConstants', () => {
  it('builds the compact layout media query from the breakpoint', () => {
    expect(COMPACT_LAYOUT_MEDIA_QUERY).toBe(`(max-width: ${COMPACT_LAYOUT_BREAKPOINT_PX}px)`);
  });

  it('keeps the CSS media queries in sync with the shared breakpoint', () => {
    const breakpointPattern = new RegExp(`max-width:\\s*${COMPACT_LAYOUT_BREAKPOINT_PX}px`);

    for (const styleSheet of ['layout/main-layout.css', 'components/editor.css']) {
      const css = readStyleSheet(styleSheet);
      expect(css, `${styleSheet} must define the compact breakpoint`).toMatch(breakpointPattern);
    }
  });
});
