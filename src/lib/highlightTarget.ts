const PARAGRAPH_SELECTOR = '.layout-paragraph';

function getElementFromNode(node: Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) {
    return node;
  }

  return node?.parentElement ?? null;
}

export function findFlashHighlightTarget(
  root: ParentNode & Node,
  selection: Selection | null,
): HTMLElement | null {
  if (!selection) {
    return null;
  }

  const anchorElement = getElementFromNode(selection.anchorNode);
  const paragraphCandidate = anchorElement?.closest(PARAGRAPH_SELECTOR) ?? null;

  if (!(paragraphCandidate instanceof HTMLElement) || !root.contains(paragraphCandidate)) {
    return null;
  }

  return paragraphCandidate;
}
