import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the profile page checks.',
  );
});

test('rail navigation is reflected in the URL and survives a refresh', async ({ page }) => {
  await page.goto('/settings/profile');
  await expect(page.getByRole('heading', { level: 2, name: 'Profile' })).toBeVisible();

  await page.getByRole('link', { name: 'Workspace' }).click();
  await expect(page).toHaveURL(/\/settings\/workspace$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Pick up where you left off' }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/settings\/workspace$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Pick up where you left off' }),
  ).toBeVisible();
});

test('a guest sees the upgrade prompts', async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authRequired: false,
        needsSetup: false,
        authenticated: false,
        user: { id: 'guest-1', email: null, name: null, avatarUrl: null, isAnonymous: true },
        providers: [{ id: 'google', label: 'Google' }],
      }),
    }),
  );

  await page.goto('/settings/profile');

  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  // exact: `getByText` matches substrings case-insensitively, so a plain 'Guest'
  // also matches this test's own `guest-1` account id and trips strict mode.
  await expect(page.getByText('Guest', { exact: true })).toBeVisible();
});

test('the data section manages and targets multiple recovery drafts', async ({ page }) => {
  await page.addInitScript(() => {
    const request = indexedDB.open('docx-editor', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('recovery-snapshots', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const store = request.result
        .transaction('recovery-snapshots', 'readwrite')
        .objectStore('recovery-snapshots');
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      store.put({
        key: 'sample:Latest.docx',
        sourceKind: 'sample',
        documentId: null,
        documentName: 'Latest.docx',
        activeParaId: null,
        savedAt: '2026-09-20T12:00:00.000Z',
        buffer,
      });
      store.put({
        key: 'local-file:Older.docx',
        sourceKind: 'local-file',
        documentId: null,
        documentName: 'Older.docx',
        activeParaId: null,
        savedAt: '2026-09-20T11:00:00.000Z',
        buffer,
      });
    };
  });
  await page.route('**/api/documents*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/account/activity**', (route) =>
    route.fulfill({ json: { events: [], nextCursor: null } }),
  );

  await page.goto('/settings/data');
  await expect(page.getByText('Latest.docx')).toBeVisible();
  await expect(page.getByText('Older.docx')).toBeVisible();
  await expect(page.locator('a[href*="recoveryName=Latest.docx"]')).toHaveAttribute(
    'href',
    /recoveryName=Latest\.docx/,
  );

  const olderCard = page.locator('.saved-document-card').filter({ hasText: 'Older.docx' });
  await olderCard.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByText('Older.docx')).toHaveCount(0);
  await expect(page.getByText('Latest.docx')).toBeVisible();
});
