export const DOCX_EXTENSION = '.docx';

/** Appends the .docx extension when missing; falls back to a placeholder name. */
export function ensureDocxName(name: string | undefined): string {
  const trimmed = `${name ?? ''}`.trim();
  if (!trimmed) {
    return `Untitled${DOCX_EXTENSION}`;
  }

  return trimmed.toLowerCase().endsWith(DOCX_EXTENSION) ? trimmed : `${trimmed}${DOCX_EXTENSION}`;
}

/** Builds the "X Copy.docx" name used when duplicating a document. */
export function createDuplicateName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.toLowerCase().endsWith(DOCX_EXTENSION)) {
    return `${trimmed.slice(0, -DOCX_EXTENSION.length)} Copy${DOCX_EXTENSION}`;
  }

  return `${trimmed} Copy${DOCX_EXTENSION}`;
}
