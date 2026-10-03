import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures/documents';

test('API health is available', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:4175/api/health');
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
});

test('API document lifecycle works end to end', async ({ request, documents }) => {
  const { id } = await documents.create(documents.name('lifecycle'), 'Lifecycle content');

  const content = await request.get(`http://127.0.0.1:4175/api/documents/${id}/content`);
  expect(content.status()).toBe(200);
  const renamed = await request.patch(`http://127.0.0.1:4175/api/documents/${id}`, { data: { name: documents.name('renamed') } });
  expect(renamed.status()).toBe(200);
  const duplicate = await request.post(`http://127.0.0.1:4175/api/documents/${id}/duplicate`);
  const duplicateId = (await duplicate.json()).id as string;
  documents.own(duplicateId);
  expect(duplicate.status()).toBe(201);
});

test('editor loads the sample workspace and core overlays work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop Chromium owns the full interaction smoke path.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();
  await expect(page.getByTitle('Built-in sample.docx')).toBeVisible();
  await expect(page.getByText('Online')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Document outline' })).toBeVisible();

  const header = page.locator('header.topbar');
  await header.getByRole('button', { name: 'Hide document outline' }).click();
  await expect(page.getByRole('complementary', { name: 'Document outline' })).toBeHidden();
  await header.getByRole('button', { name: 'Show document outline' }).click();

  await page.keyboard.press('Control+P');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();

  await page.getByRole('button', { name: 'Shortcuts' }).click();
  const shortcutDialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(shortcutDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shortcutDialog).toBeHidden();

  expect(errors, errors.join('\n')).toEqual([]);
});

test('editor has no critical or serious accessibility violations', async ({ page }) => {
  await page.goto('/app');
  const results = await new AxeBuilder({ page })
    .exclude('.editor-panel')
    .disableRules(['color-contrast'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
