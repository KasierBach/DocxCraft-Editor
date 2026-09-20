import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

export type MediaItem = {
  id: string;
  type: 'image' | 'table';
  label: string;
  paraId: string | null;
  position: number;
  paragraphIndex: number;
};

type ProseMirrorNode = {
  attrs?: Record<string, unknown>;
  type: { name: string };
  descendants: (
    callback: (node: ProseMirrorNode, position: number, parent: ProseMirrorNode | null) => boolean | void,
  ) => void;
  resolve?: (position: number) => { depth: number; node: (depth: number) => ProseMirrorNode };
};

function findParagraphId(
  doc: ProseMirrorNode,
  node: ProseMirrorNode,
  position: number,
  parent: ProseMirrorNode | null,
) {
  const directId = node.attrs?.paraId;
  if (directId) return String(directId);

  const resolved = doc.resolve?.(position);
  if (resolved) {
    for (let depth = resolved.depth; depth >= 0; depth -= 1) {
      const ancestor = resolved.node(depth);
      if (ancestor.type.name === 'paragraph' && ancestor.attrs?.paraId) {
        return String(ancestor.attrs.paraId);
      }
    }
  }

  return parent?.attrs?.paraId ? String(parent.attrs.paraId) : null;
}

export function scanForMedia(editor: DocxEditorRef): MediaItem[] {
  const doc = editor.getEditorRef()?.getState()?.doc as ProseMirrorNode | undefined;
  if (!doc) return [];

  const media: MediaItem[] = [];
  let paragraphIndex = 0;

  doc.descendants((node, position, parent) => {
    if (node.type.name === 'paragraph') paragraphIndex += 1;

    if (node.type.name !== 'image' && node.type.name !== 'table') {
      return true;
    }

    // A media node's `id` identifies the media itself, not its containing paragraph.
    // Keep position as a fallback for nodes without a stable paragraph anchor.
    const paraId = findParagraphId(doc, node, position, parent);

    if (node.type.name === 'image') {
      media.push({
        id: `image-${position}`,
        type: 'image',
        label: String(node.attrs?.alt || `Image ${media.length + 1}`),
        paraId,
        position,
        paragraphIndex,
      });
    } else {
      media.push({
        id: `table-${position}`,
        type: 'table',
        label: `Table ${media.filter((item) => item.type === 'table').length + 1}`,
        paraId,
        position,
        paragraphIndex,
      });
    }

    return true;
  });

  return media;
}
