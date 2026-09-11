import { afterEach, describe, expect, it, vi } from 'vitest';

import { convertToMarkdown, downloadMarkdown } from './exportUtils';
import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

type PageContent = {
    paragraphs: Array<{ text: string; styleId?: string }>;
};

function createEditorRef(pages: PageContent[]): DocxEditorRef {
    return {
        getTotalPages: () => pages.length,
        getPageContent: (pageNumber: number) => pages[pageNumber - 1],
    } as unknown as DocxEditorRef;
}

describe('convertToMarkdown', () => {
    it('converts paragraphs across pages into markdown blocks', () => {
        const editor = createEditorRef([
            {
                paragraphs: [
                    { text: 'Title', styleId: 'Heading1' },
                    { text: '  ', styleId: 'Normal' },
                    { text: 'Intro paragraph.', styleId: 'Normal' },
                ],
            },
            {
                paragraphs: [{ text: 'Subsection', styleId: 'Heading2' }],
            },
        ]);

        expect(convertToMarkdown(editor)).toBe('# Title\n\nIntro paragraph.\n\n## Subsection\n');
    });

    it('maps heading levels up to six', () => {
        const editor = createEditorRef([
            {
                paragraphs: [
                    { text: 'H3', styleId: 'Heading3' },
                    { text: 'H6', styleId: 'Heading6' },
                ],
            },
        ]);

        expect(convertToMarkdown(editor)).toBe('### H3\n\n###### H6\n');
    });

    it('keeps non-heading styles as plain text', () => {
        const editor = createEditorRef([
            { paragraphs: [{ text: 'Quote', styleId: 'Quote' }] },
        ]);

        expect(convertToMarkdown(editor)).toBe('Quote\n');
    });

    it('returns a trailing newline for an empty document', () => {
        const editor = createEditorRef([{ paragraphs: [] }]);

        expect(convertToMarkdown(editor)).toBe('\n');
    });
});

describe('downloadMarkdown', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function stubAnchorCreation() {
        const click = vi.fn();
        const anchors: HTMLAnchorElement[] = [];

        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = vi
            .spyOn(document, 'createElement')
            .mockImplementation((tagName: string) => {
                const anchor = originalCreateElement('a');
                if (tagName === 'a') {
                    vi.spyOn(anchor, 'click').mockImplementation(click);
                    anchors.push(anchor);
                }
                return anchor;
            });

        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL,
        });

        return { click, anchors, revokeObjectURL, createElementSpy };
    }

    it('triggers a download with a .md filename', () => {
        const { click, anchors, revokeObjectURL, createElementSpy } = stubAnchorCreation();

        downloadMarkdown('Report.docx', '# Report');

        expect(anchors).toHaveLength(1);
        expect(anchors[0]!.download).toBe('Report.md');
        expect(anchors[0]!.href).toContain('blob:mock');
        expect(click).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

        createElementSpy.mockRestore();
    });

    it('does not double the extension for markdown filenames', () => {
        const { anchors, createElementSpy } = stubAnchorCreation();

        downloadMarkdown('Notes.md', 'notes');

        expect(anchors[0]!.download).toBe('Notes.md');

        createElementSpy.mockRestore();
    });
});
