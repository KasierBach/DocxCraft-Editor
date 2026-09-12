import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBufferAsDocx } from './download';

describe('downloadBufferAsDocx', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('downloads the buffer with the given name and docx mime type', async () => {
        const click = vi.fn();

        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = vi
            .spyOn(document, 'createElement')
            .mockImplementation((tagName: string) => {
                const anchor = originalCreateElement('a');
                if (tagName === 'a') {
                    vi.spyOn(anchor, 'click').mockImplementation(click);
                }
                return anchor;
            });

        const createObjectURL = vi.fn(() => 'blob:docx-mock');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL,
            revokeObjectURL,
        });

        const blobInstances: Blob[] = [];
        const OriginalBlob = globalThis.Blob;
        class BlobSpy extends OriginalBlob {
            constructor(parts: BlobPart[], options?: BlobPropertyBag) {
                super(parts, options);
                blobInstances.push(this);
            }
        }
        vi.stubGlobal('Blob', BlobSpy);

        const buffer = new Uint8Array([1, 2, 3]).buffer;
        downloadBufferAsDocx('Export.docx', buffer);

        expect(click).toHaveBeenCalledTimes(1);
        expect(blobInstances).toHaveLength(1);
        expect(blobInstances[0]!.type).toBe(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        expect(createObjectURL).toHaveBeenCalledTimes(1);

        // The object URL is revoked asynchronously to work around WebKit
        // download aborts, so flush the pending timer before asserting.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:docx-mock');

        const createdAnchor = createElementSpy.mock.results.find(
            (result) => result.value instanceof HTMLAnchorElement,
        )?.value as HTMLAnchorElement | undefined;
        expect(createdAnchor?.download).toBe('Export.docx');
        expect(createdAnchor?.href).toContain('blob:docx-mock');

        createElementSpy.mockRestore();
    });
});
