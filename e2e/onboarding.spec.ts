import { expect, test } from '@playwright/test';

// This flow must not inherit the ordinary workflows' onboarded storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test('a new visitor completes onboarding once and reopens the editor after reload', async ({ page }) => {
  await page.goto('/app');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('1 / 3');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog).toContainText('2 / 3');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog).toContainText('3 / 3');
  await dialog.getByRole('button', { name: 'Start editing', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();
  await expect(dialog).toBeHidden();
});
