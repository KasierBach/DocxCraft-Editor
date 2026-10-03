import { expect, test } from './fixtures/documents';

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

    await page.goto('/app');
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    await expect(page.locator('.status-badge--api')).toHaveText(/offline/i, { timeout: 20_000 });
    await expect(page.locator('.editor-status-bar')).toContainText(/words/i);
  });

  test('surfaces an error toast when a save fails', async ({ page }) => {
    await page.goto('/app');
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    // Reads keep working so the app is fully loaded; only writes fail.
    await page.route('**/api/documents**', (route) =>
      route.request().method() === 'GET' ? route.continue() : route.abort(),
    );

    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.app-toast--error')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.app-toast--error')).toContainText(/could not reach the server/i);
  });

  test('opens a saved document from a deep link', async ({ page, documents }) => {
    await page.goto('/app');
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    const name = documents.name('Deep link');
    await page.getByRole('textbox', { name: 'Document name' }).fill(name);
    const savedResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/documents') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const response = await savedResponse;
    const saved = await response.json() as { id: string };
    documents.own(saved.id);
    expect(response.status()).toBe(201);
    await page.goto(`/app?source=saved&documentId=${saved.id}`);
    await page.locator('.editor-panel').waitFor({ state: 'visible' });

    await expect(page.locator('.document-name-input')).toHaveValue(name, {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`documentId=${saved.id}`));
  });
});
