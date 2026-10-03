import { expect, test } from '@playwright/test';

for (const menuName of ['Export', 'More actions']) {
  test(`${menuName} retains the chosen item after late editor focus and allows keyboard exits`, async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeAttached();
    const trigger = page.getByRole('button', { name: menuName, exact: true });
    const menu = page.getByRole('menu', { name: menuName, exact: true });

    await trigger.click();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const chosen = menu.getByRole('menuitem').nth(1);
    await expect(chosen).toBeFocused();
    await editor.evaluate((element: HTMLElement) => element.focus());
    await expect(menu).toBeVisible();
    await expect(chosen).toBeFocused();

    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+Tab');
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await expect(menu).not.toBeVisible();
    await expect(page.locator('body')).not.toBeFocused();

    await trigger.click();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(menu).toBeVisible();
    await page.getByRole('heading', { name: 'DOCX Workspace' }).click();
    await expect(menu).not.toBeVisible();
  });
}
