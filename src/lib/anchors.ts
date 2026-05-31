export type PageContent = {
  pageNumber: number;
  text: string;
  paragraphs: Array<{
    paraId: string;
    text: string;
    styleId?: string;
  }>;
};

export type AnchorTarget = {
  id: string;
  label: string;
  pageNumber: number;
  paragraphIndex: number;
  styleId?: string;
};

const MAX_LABEL_LENGTH = 62;

function normalizePreview(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= MAX_LABEL_LENGTH) {
    return compact;
  }

  const truncated = compact.slice(0, MAX_LABEL_LENGTH).trimEnd();
  const nextCharacter = compact.charAt(truncated.length);

  if (!nextCharacter || /\s/.test(nextCharacter)) {
    return `${truncated}...`;
  }

  const lastWordBoundary = truncated.lastIndexOf(' ');

  if (lastWordBoundary <= 0) {
    return `${truncated}...`;
  }

  return `${truncated.slice(0, lastWordBoundary)}...`;
}

export function collectAnchorTargets(pages: PageContent[]): AnchorTarget[] {
  const anchors: AnchorTarget[] = [];
  let paragraphIndex = 0;

  for (const page of pages) {
    for (const paragraph of page.paragraphs) {
      const label = normalizePreview(paragraph.text);
      if (label.length > 0) {
        anchors.push({
          id: paragraph.paraId,
          label,
          pageNumber: page.pageNumber,
          paragraphIndex,
          styleId: paragraph.styleId,
        });
      }

      paragraphIndex += 1;
    }
  }

  return anchors;
}
