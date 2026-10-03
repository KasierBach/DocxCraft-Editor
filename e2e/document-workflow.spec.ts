import { createDocxFixture, expect, test } from './fixtures/documents';

const API_BASE = 'http://127.0.0.1:4175';

test('open a saved document, duplicate it, and reopen after reload', async ({ page, documents }) => {
    test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the full interaction path.',
    );

    const created = await documents.create(documents.name('Save Flow'), 'E2E Save Flow');
    const copyName = created.name.replace(/\.docx$/, ' Copy.docx');

    await page.goto('/app');
    await page.getByRole('button', { name: `Open ${created.name}`, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Document name' })).toHaveValue(
        created.name,
    );
    await expect(page.locator('.editor-panel')).toContainText('E2E Save Flow');

    await page.reload();
    await page.getByRole('button', { name: `Open ${created.name}`, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Document name' })).toHaveValue(
        created.name,
    );
    await expect(page.getByText('Online')).toBeVisible();

    const duplicateResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/documents/${created.id}/duplicate`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: `Duplicate ${created.name}`, exact: true }).click();
    const response = await duplicateResponse;
    const duplicate = await response.json() as { id: string };
    documents.own(duplicate.id);
    expect(response.status()).toBe(201);
    await expect(
        page.getByRole('button', { name: `Open ${copyName}`, exact: true }),
    ).toBeVisible();
});

test('version history grows with updates and restores an older version', async ({ request, documents }) => {
    const created = await documents.create(documents.name('Versions'), 'E2E Versions');

    const updated = await request.put(`${API_BASE}/api/documents/${created.id}`, {
        headers: {
            'content-type': 'application/octet-stream',
            'x-document-name': encodeURIComponent(created.name),
        },
        data: await createDocxFixture('E2E Versions Updated'),
    });
    expect(updated.status()).toBe(200);

    const versionsResponse = await request.get(`${API_BASE}/api/documents/${created.id}/versions`);
    const versions = (await versionsResponse.json()) as Array<{ id: string }>;
    expect(versions.length).toBe(2);

    const oldest = versions[versions.length - 1]!;
    const restoreResponse = await request.get(
        `${API_BASE}/api/documents/${created.id}/versions/${oldest.id}/content`,
    );
    expect(restoreResponse.status()).toBe(200);
    const restoredBody = await restoreResponse.body();
    expect(restoredBody.byteLength).toBeGreaterThan(0);

    const restored = await request.put(`${API_BASE}/api/documents/${created.id}`, {
        headers: {
            'content-type': 'application/octet-stream',
            'x-document-name': encodeURIComponent(created.name),
        },
        data: restoredBody,
    });
    expect(restored.status()).toBe(200);

    const finalVersions = await request.get(`${API_BASE}/api/documents/${created.id}/versions`);
    const finalList = (await finalVersions.json()) as Array<{ id: string }>;
    expect(finalList.length).toBe(3);
});

test('theme toggle switches surfaces and persists across reloads', async ({ page }) => {
    test.skip(
        test.info().project.name !== 'chromium',
        'Desktop Chromium owns the full interaction path.',
    );

    await page.goto('/app');
    const shell = page.locator('.app-shell');
    await expect(shell).toBeVisible();

    const lightBackground = await shell.evaluate((element) =>
        getComputedStyle(element).backgroundColor,
    );

    await page.getByRole('button', { name: /switch to dark theme/i }).click();
    const darkBackground = await shell.evaluate((element) =>
        getComputedStyle(element).backgroundColor,
    );
    expect(darkBackground).not.toBe(lightBackground);

    await page.reload();
    await expect(shell).toBeVisible();
    const persistedBackground = await shell.evaluate((element) =>
        getComputedStyle(element).backgroundColor,
    );
    expect(persistedBackground).toBe(darkBackground);

    await page.getByRole('button', { name: /switch to light theme/i }).click();
    const revertedBackground = await shell.evaluate((element) =>
        getComputedStyle(element).backgroundColor,
    );
    expect(revertedBackground).toBe(lightBackground);
});
