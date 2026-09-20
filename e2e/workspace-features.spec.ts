import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'chromium', 'Desktop Chromium owns advanced workspace flows.');
});

test('profile AI, notifications, organization tools, and template import flows work', async ({ page }) => {
  let document = {
    id: 'd1',
    name: 'Report.docx',
    folder: null as string | null,
    tags: [] as string[],
    isStarred: false,
    updatedAt: '2026-09-20T00:00:00.000Z',
    sizeInBytes: 2048,
    role: 'owner',
  };

  await page.route('**/api/ai/settings', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { provider?: string; model?: string; enabled?: boolean };
      await route.fulfill({ json: { provider: body.provider ?? 'openai-compatible', model: body.model ?? 'gpt-test', baseUrl: 'https://ai.example/v1', enabled: body.enabled ?? true, providers: [{ id: 'openai-compatible', label: 'OpenAI-compatible', protocol: 'openai-compatible', defaultBaseUrl: 'https://api.openai.com/v1', models: ['gpt-test'], capabilities: ['streaming', 'tools'] }] } });
      return;
    }
    await route.fulfill({ json: { enabled: true, provider: 'openai-compatible', model: 'gpt-test', baseUrl: 'https://ai.example/v1', providers: [{ id: 'openai-compatible', label: 'OpenAI-compatible', protocol: 'openai-compatible', defaultBaseUrl: 'https://api.openai.com/v1', models: ['gpt-test'], capabilities: ['streaming', 'tools'] }], keySource: 'operator-env', apiKeyConfigured: true, usage: { requests: 2, inputTokens: 0, outputTokens: 0, windowStarted: '2026-09-20T00:00:00.000Z' }, maxRequestsPerHour: 30 } });
  });
  await page.route('**/api/workspace/notifications*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ json: [{ id: 'n1', type: 'document.shared', payload: null, readAt: null, createdAt: '2026-09-20T00:00:00.000Z' }] });
  });
  await page.route('**/api/workspace/documents*', async (route) => {
    if (route.request().method() === 'PATCH') {
      document = { ...document, ...(route.request().postDataJSON() as Partial<typeof document>) };
      await route.fulfill({ json: document });
      return;
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { updated: 1 } });
      return;
    }
    await route.fulfill({ json: [document] });
  });
  await page.route('**/api/documents/import-url', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ url: 'https://drive.google.com/uc?export=download&id=abc123' });
    await route.fulfill({ json: { id: 'imported-1', name: 'Imported.docx' } });
  });

  await page.goto('/settings/ai');
  await expect(page.getByRole('heading', { name: 'AI assistant' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Model' }).fill('gpt-next');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/2 of 30 requests/i)).toBeVisible();

  await page.goto('/app');
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'AI assistant' }).click();
  await expect(page.getByRole('region', { name: 'AI assistant' })).toBeVisible();
  await page.goto('/settings/ai');

  await page.getByRole('link', { name: 'Notifications' }).click();
  await expect(page.getByText('document.shared')).toBeVisible();
  await page.getByRole('button', { name: 'Mark all read' }).click();

  await page.getByRole('link', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'Load organization tools' }).click();
  await expect(page.getByText('Report.docx')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Report.docx' }).check();
  await page.getByRole('button', { name: 'Star selected' }).click();

  await page.getByRole('link', { name: 'Templates' }).click();
  await page.getByRole('textbox', { name: 'Document URL' }).fill('https://drive.google.com/file/d/abc123/view');
  await page.getByRole('button', { name: 'Import and open' }).click();
  await expect(page).toHaveURL(/\/app\?source=saved&documentId=imported-1/);
});
