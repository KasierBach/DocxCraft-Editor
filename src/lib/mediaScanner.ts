import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

export type MediaItem = {
  id: string;
  type: 'image' | 'table';
  label: string;
  paraId: string;
  paragraphIndex: number;
};

type ProseMirrorNode = {
  attrs?: Record<string, unknown>;
  type: { name: string };
  descendants: (
    callback: (node: ProseMirrorNode, position: number, parent: ProseMirrorNode | null) => boolean | void,
  ) => void;
};

export function scanForMedia(editor: DocxEditorRef): MediaItem[] {
  const doc = editor.getEditorRef()?.getState()?.doc as ProseMirrorNode | undefined;
  if (!doc) return [];

  const media: MediaItem[] = [];
  let paragraphIndex = 0;

  doc.descendants((node, position, parent) => {
    if (node.type.name === 'paragraph') paragraphIndex += 1;

    const paraId = String(
      node.attrs?.paraId ?? node.attrs?.id ?? parent?.attrs?.paraId ?? parent?.attrs?.id ?? '',
    );

    if (node.type.name === 'image') {
      media.push({
        id: `image-${position}`,
        type: 'image',
        label: String(node.attrs?.alt ?? `Image ${media.length + 1}`),
        paraId,
        paragraphIndex,
      });
    } else if (node.type.name === 'table') {
      media.push({
        id: `table-${position}`,
        type: 'table',
        label: `Table ${media.filter((item) => item.type === 'table').length + 1}`,
        paraId,
        paragraphIndex,
      });
    }

    return true;
  });

  return media;
}