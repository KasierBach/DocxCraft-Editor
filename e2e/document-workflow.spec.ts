import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

const API_BASE = 'http://127.0.0.1:4175';

async function createDocxFixture(content: string) {
    const zip = new JSZip();
    zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    );
    zip.file(
        'word/document.xml',
        `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${content}</w:t></w:r></w:p></w:body></w:document>`,
    );
    return zip.generateAsync({ type: 'nodebuffer' });
}

async function createDocument(request: import('@playwright/test').APIRequestContext, name: string, content: string) {
    const created = await request.post(`${API_BASE}/api/documents`, {
        headers: {
            'content-type': 'application/octet-stream',
            'x-document-name': encodeURIComponent(name),
        },
        data: await createDocxFixture(content),
    });
    expect(created.status()).toBe(201);
    return (await created.json()) as { id: string; name: string };
}

test('open a saved document, duplicate it, and reopen after reload', async ({ page, request }) => {
    test.skip(
        test.info().project.name !== 'chromium',
        'Desktop Chromium owns the full interaction path.',
    );

    const created = await createDocument(request, 'E2E Save Flow.docx', 'E2E Save Flow');

    try {
        await page.goto('/');
        await page.getByRole('button', { name: 'Open E2E Save Flow.docx' }).click();
        await expect(page.getByRole('textbox', { name: 'Document name' })).toHaveValue(
            'E2E Save Flow.docx',
        );

        await page.reload();
        await page.getByRole('button', { name: 'Open E2E Save Flow.docx' }).click();
        await expect(page.getByRole('textbox', { name: 'Document name' })).toHaveValue(
            'E2E Save Flow.docx',
        );
        await expect(page.getByText('Online')).toBeVisible();

        await page.getByRole('button', { name: 'Duplicate E2E Save Flow.docx' }).click();
        await expect(
            page.getByRole('button', { name: 'Open E2E Save Flow Copy.docx' }),
        ).toBeVisible();
    } finally {
        const listResponse = await request.get(`${API_BASE}/api/documents`);
        const documents = (await listResponse.json()) as Array<{ id: string; name: string }>;
        for (const document of documents.filter((entry) => entry.name.startsWith('E2E Save Flow'))) {
            await request.delete(`${API_BASE}/api/documents/${document.id}`);
        }
    }
});

test('version history grows with updates and restores an older version', async ({ request }) => {
    const created = await createDocument(request, 'E2E Versions.docx', 'E2E Versions');

    try {
        const updated = await request.put(`${API_BASE}/api/documents/${created.id}`, {
            headers: {
                'content-type': 'application/octet-stream',
                'x-document-name': encodeURIComponent('E2E Versions.docx'),
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
                'x-document-name': encodeURIComponent('E2E Versions.docx'),
            },
            data: restoredBody,
        });
        expect(restored.status()).toBe(200);

        const finalVersions = await request.get(`${API_BASE}/api/documents/${created.id}/versions`);
        const finalList = (await finalVersions.json()) as Array<{ id: string }>;
        expect(finalList.length).toBe(3);
    } finally {
        await request.delete(`${API_BASE}/api/documents/${created.id}`);
    }
});

test('theme toggle switches surfaces and persists across reloads', async ({ page }) => {
    test.skip(
        test.info().project.name !== 'chromium',
        'Desktop Chromium owns the full interaction path.',
    );

    await page.goto('/');
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
