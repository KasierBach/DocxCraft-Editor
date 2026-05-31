import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror';

import type { AnchorTarget } from './anchors';

type SelectionInfo = {
  paraId: string | null;
};

type ResolveActiveAnchorOptions = {
  anchors: AnchorTarget[];
  selectionInfo: SelectionInfo | null;
  selectionState: SelectionState | null;
  fallbackActiveParaId?: string | null;
  preferFirstAnchor?: boolean;
};

function findNearestPrecedingAnchor(anchors: AnchorTarget[], targetIndex: number): AnchorTarget | null {
  let nearest: AnchorTarget | null = null;
  
  for (const anchor of anchors) {
    if (anchor.paragraphIndex <= targetIndex) {
      if (!nearest || anchor.paragraphIndex > nearest.paragraphIndex) {
        nearest = anchor;
      }
    }
  }
  
  return nearest;
}

export function resolveActiveAnchorId({
  anchors,
  selectionInfo,
  selectionState,
  fallbackActiveParaId = null,
  preferFirstAnchor = false,
}: ResolveActiveAnchorOptions): string | null {
  if (anchors.length === 0) {
    return null;
  }

  if (selectionInfo?.paraId) {
    const directMatch = anchors.find((anchor) => anchor.id === selectionInfo.paraId) ?? null;
    if (directMatch) {
      return directMatch.id;
    }
  }

  const targetIndex = selectionState?.startParagraphIndex;
  if (typeof targetIndex === 'number') {
    const nearestMatch = findNearestPrecedingAnchor(anchors, targetIndex);
    if (nearestMatch) {
      return nearestMatch.id;
    }
  }

  if (fallbackActiveParaId) {
    const fallbackMatch = anchors.find((anchor) => anchor.id === fallbackActiveParaId) ?? null;
    if (fallbackMatch) {
      return fallbackMatch.id;
    }
  }

  return preferFirstAnchor ? anchors[0]?.id ?? null : null;
}
