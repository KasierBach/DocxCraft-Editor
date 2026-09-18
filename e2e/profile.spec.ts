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
