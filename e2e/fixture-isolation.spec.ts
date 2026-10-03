import JSZip from 'jszip';

import { createDocxFixture, expect, test, withDocuments } from './fixtures/documents';

test('DOCX fixture preserves XML-like Vietnamese text without creating markup', async () => {
  const zip = await JSZip.loadAsync(await createDocxFixture('Điểm <7 & "đạt">'));
  expect(await zip.file('word/document.xml')!.async('string')).toContain('Điểm &lt;7 &amp; &quot;đạt&quot;&gt;');
});

test('fixture owns only its created IDs', async ({ request, documents }) => {
  const name = documents.name('same-name');
  const unrelated = await documents.create(name, 'Unrelated document');
  let ownedId = '';
  await withDocuments(request, async (owned) => {
    ownedId = (await owned.create(name, 'Owned document')).id;
    expect(ownedId).not.toBe(unrelated.id);
  });
  expect((await request.get(`/api/documents/${ownedId}/content`)).status()).toBe(404);
  const surviving = await request.get(`/api/documents/${unrelated.id}/content`);
  expect(surviving.status()).toBe(200);
  const zip = await JSZip.loadAsync(await surviving.body());
  expect(await zip.file('word/document.xml')!.async('string')).toContain('Unrelated document');
});

test('failed test cleanup runs for every owned ID', async ({ request, documents }) => {
  const ids: string[] = [];
  await expect(withDocuments(request, async (owned) => {
    ids.push((await owned.create(documents.name('failed-first'), 'First')).id);
    ids.push((await owned.create(documents.name('failed-second'), 'Second')).id);
    throw new Error('deliberate action failure');
  })).rejects.toThrow('deliberate action failure');
  for (const id of ids) {
    expect((await request.get(`/api/documents/${id}/content`)).status()).toBe(404);
  }
});

test('same-name documents do not cross-select', async ({ page, documents }) => {
  const name = documents.name('same-name');
  const first = await documents.create(name, 'Only document A');
  const second = await documents.create(name, 'Only document B');
  await page.goto(`/app?source=saved&documentId=${second.id}`);
  // Vite's cold module load is separate from the document selection contract.
  await expect(page.getByRole('heading', { name: 'DOCX Workspace', exact: true })).toBeVisible();
  await expect(page.locator('.editor-panel')).toContainText('Only document B');
  await expect(page.locator('.editor-panel')).not.toContainText('Only document A');
  await page.goto(`/app?source=saved&documentId=${first.id}`);
  await expect(page.getByRole('heading', { name: 'DOCX Workspace', exact: true })).toBeVisible();
  await expect(page.locator('.editor-panel')).toContainText('Only document A');
  await expect(page.locator('.editor-panel')).not.toContainText('Only document B');
});
