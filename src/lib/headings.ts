const HEADING_STYLE_PATTERN = /^Heading([1-9])$/i;

export function getHeadingLevel(styleId: string | null | undefined): number | null {
  const level = styleId?.match(HEADING_STYLE_PATTERN)?.[1];
  return level ? Number(level) : null;
}
