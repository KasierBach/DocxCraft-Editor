import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

import { getHeadingLevel } from './headings';
import { triggerBlobDownload } from './download';

const MAX_MARKDOWN_HEADING_LEVEL = 6;

export function convertToMarkdown(editor: DocxEditorRef): string {
  const blocks: string[] = [];

  for (let pageNumber = 1; pageNumber <= editor.getTotalPages(); pageNumber += 1) {
    const page = editor.getPageContent(pageNumber);

    for (const paragraph of page?.paragraphs ?? []) {
      const text = paragraph.text.trim();
      if (!text) continue;

      const headingLevel = getHeadingLevel(paragraph.styleId);
      blocks.push(
        headingLevel
          ? `${'#'.repeat(Math.min(headingLevel, MAX_MARKDOWN_HEADING_LEVEL))} ${text}`
          : text,
      );
    }
  }

  return `${blocks.join('\n\n')}\n`;
}

export function downloadMarkdown(filename: string, content: string) {
  const baseName = filename.replace(/\.docx$/i, '').replace(/\.md$/i, '');
  triggerBlobDownload(
    `${baseName}.md`,
    new Blob([content], { type: 'text/markdown;charset=utf-8' }),
  );
}