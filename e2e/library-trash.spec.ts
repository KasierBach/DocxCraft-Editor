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

test('moves a document to trash and restores it from the library', async ({ page, request }) => {
    test.skip(
        test.info().project.name !== 'chromium',
        'Desktop Chromium owns the full interaction path.',
    );

    const created = await createDocument(request, 'E2E Trash Flow.docx', 'E2E Trash Flow');

    try {
        await page.goto('/documents');
        const openButton = page.getByRole('button', { name: 'Open E2E Trash Flow.docx' });
        await expect(openButton).toBeVisible();

        await page.getByRole('button', { name: 'Delete E2E Trash Flow.docx' }).click();
        await page.getByRole('button', { name: 'Confirm delete E2E Trash Flow.docx' }).click();
        await expect(openButton).toHaveCount(0);

        await page.getByRole('button', { name: 'Trash', exact: true }).click();
        await expect(page).toHaveURL(/view=trash/);
        await expect(page.getByText('E2E Trash Flow.docx')).toBeVisible();

        await page.getByRole('button', { name: 'Restore E2E Trash Flow.docx' }).click();

        await page.getByRole('button', { name: 'Documents', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Open E2E Trash Flow.docx' })).toBeVisible();
    } finally {
        // Tolerant cleanup: the delete is a no-op if the document is already
        // trashed, and the purge handles both the restored and trashed cases.
        await request.delete(`${API_BASE}/api/documents/${created.id}`);
        await request.delete(`${API_BASE}/api/documents/${created.id}/purge`);
    }
});
