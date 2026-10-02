import { expect, test } from '@playwright/test';

test('public pages do not fetch private routes until the user opens the editor', async ({ page }) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (['/src/App.tsx', '/src/features/library/DocumentsPage.tsx', '/src/features/profile/ProfilePage.tsx'].includes(path)) {
      privateRequests.push(path);
    }
  });

  for (const path of ['/', '/docs', '/changelog', '/privacy', '/terms']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
  }
  expect(privateRequests).toEqual([]);

  await page.goto('/');
  await page.locator('.landing-nav__actions .landing-button--primary').click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'DOCX Workspace' })).toBeVisible();
  await expect(page.getByTitle('Built-in sample.docx')).toBeVisible();
  expect(privateRequests).toEqual(['/src/App.tsx']);
});

test('a slow editor download shows a loading state then opens the document', async ({ page }) => {
  let release!: () => void;
  const download = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/src/App.tsx', async (route) => {
    await download;
    await route.continue();
  });

  try {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    const loading = page.locator('[role="status"][aria-busy="true"]');
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toContainText('Loading');
    release();
    await expect(page.getByTitle('Built-in sample.docx')).toBeVisible();
    await expect(loading).toBeHidden();
  } finally {
    release();
  }
});

test('a failed editor download offers reload recovery', async ({ page }) => {
  await page.route('**/src/App.tsx', (route) => route.abort());
  await page.goto('/app');
  const reload = page.getByRole('button', { name: 'Reload page', exact: true });
  await expect(reload).toBeVisible();
  await page.unroute('**/src/App.tsx');
  await reload.click();
  await expect(page.getByTitle('Built-in sample.docx')).toBeVisible();
});
