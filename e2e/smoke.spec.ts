import { expect, test } from '@playwright/test';

test('API health is available', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:4175/api/health');
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
});

test('editor loads the sample workspace and core overlays work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
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
