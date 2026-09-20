import { expect, test } from '@playwright/test';

const PASSPHRASE = 'docxcraft-e2e-passphrase';

test('claims the instance, signs in, keeps the session, and signs out', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Set your passphrase' })).toBeVisible();

  const passphrase = page.getByLabel('Passphrase', { exact: true });
  const confirmation = page.getByLabel('Repeat passphrase');
  const saveButton = page.getByRole('button', { name: 'Save passphrase and start' });

  await passphrase.fill('short');
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await passphrase.fill(PASSPHRASE);
  await confirmation.fill('different-passphrase');
  await expect(page.getByText('The passphrases do not match.')).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await confirmation.fill(PASSPHRASE);
  await saveButton.click();
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByLabel('Passphrase', { exact: true }).fill('wrong-passphrase');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();
});
