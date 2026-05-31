import { createEmptyDocument } from '@eigenpal/docx-editor-react';
import type { Document, Paragraph } from '@eigenpal/docx-editor-core';

function paragraph(options: {
  paraId: string;
  text: string;
  styleId?: string;
  outlineLevel?: number;
  pageBreakBefore?: boolean;
}): Paragraph {
  const formatting =
    options.styleId || options.outlineLevel !== undefined || options.pageBreakBefore
      ? {
          styleId: options.styleId,
          outlineLevel: options.outlineLevel,
          pageBreakBefore: options.pageBreakBefore,
        }
      : undefined;

  return {
    type: 'paragraph',
    paraId: options.paraId,
    formatting,
    content: [
      {
        type: 'run',
        content: [{ type: 'text', text: options.text }],
      },
    ],
  };
}

export function createDemoDocument(): Document {
  const document = createEmptyDocument({
    initialText: 'Docx Editor Scroll Demo',
  }) as Document;

  document.package.document.content = [
    paragraph({
      paraId: 'D0C0A001',
      text: 'Docx Editor Scroll Demo',
      styleId: 'Title',
    }),
    paragraph({
      paraId: 'D0C0A002',
      text: 'This built-in document gives every paragraph a stable paraId so the jump buttons know exactly where to scroll.',
    }),
    paragraph({
      paraId: 'D0C0A101',
      text: '1. Why paraId is the anchor',
      styleId: 'Heading1',
      outlineLevel: 0,
    }),
    paragraph({
      paraId: 'D0C0A102',
      text: 'Instead of storing a brittle character offset, the demo reads paragraph anchors from the document model and passes that paraId to scrollToParaId.',
    }),
    paragraph({
      paraId: 'D0C0A103',
      text: 'You can edit this text, refresh the anchor map, and the buttons will still target the same paragraphs as long as the paraId stays with them.',
    }),
    paragraph({
      paraId: 'D0C0B101',
      text: '2. Second page target',
      styleId: 'Heading1',
      outlineLevel: 0,
      pageBreakBefore: true,
    }),
    paragraph({
      paraId: 'D0C0B102',
      text: 'This heading starts on another page so scrolling is obvious when you click its button from the sidebar.',
    }),
    paragraph({
      paraId: 'D0C0B103',
      text: 'The sidebar shows the page number, visible label, and raw paraId together so the target is explainable instead of random.',
    }),
    paragraph({
      paraId: 'D0C0C101',
      text: '3. Final checkpoint',
      styleId: 'Heading1',
      outlineLevel: 0,
      pageBreakBefore: true,
    }),
    paragraph({
      paraId: 'D0C0C102',
      text: 'Try placing the caret here, then compare the current paraId badge with the jump buttons on the left.',
    }),
  ];

  return document;
}
