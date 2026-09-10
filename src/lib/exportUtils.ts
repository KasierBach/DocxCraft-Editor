import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

export function convertToMarkdown(editor: DocxEditorRef): string {
  const blocks: string[] = [];

  for (let pageNumber = 1; pageNumber <= editor.getTotalPages(); pageNumber += 1) {
    const page = editor.getPageContent(pageNumber);

    for (const paragraph of page?.paragraphs ?? []) {
      const text = paragraph.text.trim();
      if (!text) continue;

      const headingLevel = Number(paragraph.styleId?.match(/^Heading(\d)$/i)?.[1]);
      blocks.push(headingLevel ? `${'#'.repeat(headingLevel)} ${text}` : text);
    }
  }

  return `${blocks.join('\n\n')}\n`;
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename.replace(/\.docx$/i, '').replace(/\.md$/i, '') + '.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}