import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the resilience spec.',
  );
});

test.describe('resilience', () => {
  test('keeps the editor usable and reports offline when the API is unreachable', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());

    await page.goto('/');
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    await expect(page.locator('.status-badge--api')).toHaveText(/offline/i, { timeout: 20_000 });
    await expect(page.locator('.editor-status-bar')).toContainText(/words/i);
  });

  test('surfaces an error toast when a save fails', async ({ page }) => {
    await page.goto('/');
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    // Reads keep working so the app is fully loaded; only writes fail.
    await page.route('**/api/documents**', (route) =>
      route.request().method() === 'GET' ? route.continue() : route.abort(),
    );

    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.app-toast--error')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.app-toast--error')).toContainText(/could not reach the server/i);
  });

  test('opens a saved document from a deep link', async ({ page, request }) => {
    await page.goto('/');
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.app-toast')).toBeVisible({ timeout: 15_000 });

    const documents = await (await request.get('/api/documents')).json();
    const saved = documents.find(
      (document: { name: string }) => document.name === 'Built-in sample.docx',
    );
    expect(saved, 'the saved document is in the library').toBeTruthy();

    try {
      await page.goto(`/?documentId=${saved.id}`);
      await page.locator('.editor-panel').waitFor({ state: 'visible' });

      await expect(page.locator('.document-name-input')).toHaveValue('Built-in sample.docx', {
        timeout: 15_000,
      });
    } finally {
      await request.delete(`/api/documents/${saved.id}`);
    }
  });
});
