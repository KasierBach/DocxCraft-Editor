import { randomUUID } from 'node:crypto';

import { expect, test as base, type APIRequestContext } from '@playwright/test';
import JSZip from 'jszip';

const API_BASE = 'http://127.0.0.1:4175';

export async function createDocxFixture(content: string): Promise<Buffer> {
  const zip = new JSZip();
  const text = content.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function createDocument(request: APIRequestContext, name: string, content: string): Promise<{ id: string; name: string }> {
  const response = await request.post(`${API_BASE}/api/documents`, {
    headers: { 'content-type': 'application/octet-stream', 'x-document-name': encodeURIComponent(name) },
    data: await createDocxFixture(content),
  });
  expect(response.status()).toBe(201);
  return response.json();
}

type Documents = {
  create: (name: string, content: string) => Promise<{ id: string; name: string }>;
  own: (id: string) => void;
  name: (label: string) => string;
};

// Also used directly to exercise teardown after a deliberately failed action.
export async function withDocuments(request: APIRequestContext, use: (documents: Documents) => Promise<void>): Promise<void> {
  const owned = new Set<string>();
  try {
    await use({
      create: async (name, content) => {
        const document = await createDocument(request, name, content);
        owned.add(document.id);
        return document;
      },
      own: (id) => { owned.add(id); },
      name: (label) => `E2E ${label} ${randomUUID()}.docx`,
    });
  } finally {
    // Start every cleanup even if one fails; never find/delete by name or prefix.
    const results = await Promise.allSettled([...owned].map(async (id) => {
      const response = await request.delete(`${API_BASE}/api/documents/${id}`);
      expect([204, 404]).toContain(response.status());
    }));
    const failures = results.filter((result) => result.status === 'rejected');
    expect(failures, 'all owned document cleanup requests must succeed').toEqual([]);
  }
}

export const test = base.extend<{ documents: Documents }>({
  documents: async ({ request }, use) => { await withDocuments(request, use); },
});
export { expect };
