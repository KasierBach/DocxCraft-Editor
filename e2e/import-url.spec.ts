import { expect, test } from '@playwright/test';

test('unsafe URL imports show an error, keep the form usable and never persist a document', async ({ page, request }) => {
  const before = await (await request.get('/api/documents')).json();
  await page.goto('/settings/templates');
  const input = page.getByRole('textbox', { name: 'Document URL' });
  const submit = page.getByRole('button', { name: 'Import and open' });
  for (const url of [
    'https://127.0.0.1/internal.docx',
    'https://[::ffff:127.0.0.1]/internal.docx',
    'https://user:secret@127.0.0.1/internal.docx',
  ]) {
    await input.fill(url);
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/documents/import-url')),
      submit.click(),
    ]);
    expect(response.status()).toBe(400);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(page).toHaveURL(/\/settings\/templates$/);
  }
  expect(await (await request.get('/api/documents')).json()).toEqual(before);
});

test('import overload releases the loading state and allows retry', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/documents/import-url', async (route) => {
    await pending;
    await route.fulfill({ status: 429, headers: { 'retry-after': '15' }, json: { message: 'Too many document imports. Try again shortly.' } });
  });
  await page.goto('/settings/templates');
  await page.getByRole('textbox', { name: 'Document URL' }).fill('https://127.0.0.1/internal.docx');
  await page.getByRole('button', { name: 'Import and open' }).click();
  await expect(page.locator('form button[type="submit"]')).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  const submit = page.getByRole('button', { name: 'Import and open' });
  await expect(submit).toBeEnabled();
  await page.unroute('**/api/documents/import-url');
  const [retry] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/documents/import-url')),
    submit.click(),
  ]);
  expect(retry.status()).toBe(400);
  await expect(submit).toBeEnabled();
});
