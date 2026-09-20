import JSZip from 'jszip';

/** Extracts searchable body text without turning the DOCX into a second document model. */
export async function extractDocxText(buffer: Uint8Array) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) return '';

  return documentXml
    .replace(/<w:tab\s*\/?>(?=.)/g, '\t')
    .replace(/<w:br\s*\/?>(?=.)/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\r\f]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 200_000);
}
