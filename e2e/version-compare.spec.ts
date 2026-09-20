import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

const API_BASE = 'http://127.0.0.1:4175';

async function createDocxFixture(content: string) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${content}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('compares document versions from the editor sidebar', async ({ page, request }) => {
  test.skip(test.info().project.name !== 'chromium', 'Desktop Chromium owns the full interaction path.');

  const createdResponse = await request.post(`${API_BASE}/api/documents`, {
    headers: {
      'content-type': 'application/octet-stream',
      'x-document-name': encodeURIComponent('E2E Compare.docx'),
    },
    data: await createDocxFixture('Original conclusion'),
  });
  expect(createdResponse.status()).toBe(201);
  const created = (await createdResponse.json()) as { id: string };

  try {
    const updated = await request.put(`${API_BASE}/api/documents/${created.id}`, {
      headers: {
        'content-type': 'application/octet-stream',
        'x-document-name': encodeURIComponent('E2E Compare.docx'),
      },
      data: await createDocxFixture('Revised conclusion'),
    });
    expect(updated.status()).toBe(200);

    await page.goto('/app');
    await page.getByRole('button', { name: 'Open E2E Compare.docx' }).click();
    await page.getByRole('button', { name: 'Compare', exact: true }).click();

    const diff = page.locator('.version-diff');
    await expect(diff).toContainText('Compared with latest');
    await expect(diff).toContainText('Original conclusion');
    await expect(diff).toContainText('Revised conclusion');
  } finally {
    await request.delete(`${API_BASE}/api/documents/${created.id}`);
  }
});
