import { describe, expect, it } from 'vitest';

import { scanForMedia } from './mediaScanner';
import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

type TestNode = {
    type: { name: string };
    attrs?: Record<string, unknown>;
    children?: TestNode[];
};

function node(name: string, attrs?: Record<string, unknown>, children?: TestNode[]): TestNode {
    return { type: { name }, attrs, children };
}

function createEditorRef(root: TestNode | null): DocxEditorRef {
    return {
        getEditorRef: () =>
            (root
                ? {
                    getState: () => ({
                        doc: {
                            descendants: (callback: (n: TestNode, pos: number, parent: TestNode | null) => boolean | void) => {
                                const visit = (current: TestNode, position: number, parent: TestNode | null) => {
                                    const proceed = callback(current, position, parent);
                                    if (proceed === false) return;
                                    current.children?.forEach((child, index) => {
                                        visit(child, position + index + 1, current);
                                    });
                                };
                                visit(root, 0, null);
                            },
                        },
                    }),
                }
                : null) as unknown as ReturnType<DocxEditorRef['getEditorRef']>,
    } as unknown as DocxEditorRef;
}

describe('scanForMedia', () => {
    it('returns an empty list when the editor ref is unavailable', () => {
        expect(scanForMedia(createEditorRef(null))).toEqual([]);
    });

    it('collects images with alt text and paragraph ids', () => {
        const editor = createEditorRef(
            node('doc', undefined, [
                node('paragraph', { paraId: 'para-1' }, [node('image', { alt: 'Chart overview' })]),
            ]),
        );

        const media = scanForMedia(editor);
        expect(media).toEqual([
            {
                id: expect.stringMatching(/^image-/),
                type: 'image',
                label: 'Chart overview',
                paraId: 'para-1',
                paragraphIndex: 1,
            },
        ]);
    });

    it('falls back to a generated label when the image has no alt text', () => {
        const editor = createEditorRef(
            node('doc', undefined, [
                node('paragraph', { paraId: 'para-1' }, [node('image')]),
            ]),
        );

        const media = scanForMedia(editor);
        expect(media[0]!.label).toBe('Image 1');
    });

    it('numbers tables sequentially and ignores other node types', () => {
        const editor = createEditorRef(
            node('doc', undefined, [
                node('paragraph', { paraId: 'para-1' }, [node('text')]),
                node('table', { paraId: 'para-2' }),
                node('table'),
                node('blockquote'),
            ]),
        );

        const media = scanForMedia(editor);
        expect(media).toEqual([
            {
                id: expect.stringMatching(/^table-/),
                type: 'table',
                label: 'Table 1',
                paraId: 'para-2',
                paragraphIndex: 1,
            },
        ]);
    });

    it('counts paragraph indices across the document', () => {
        const editor = createEditorRef(
            node('doc', undefined, [
                node('paragraph', { paraId: 'p1' }),
                node('paragraph', { paraId: 'p2' }, [node('image')]),
                node('paragraph', { paraId: 'p3' }, [node('table')]),
            ]),
        );

        const media = scanForMedia(editor);
        expect(media.map((item) => item.paragraphIndex)).toEqual([2, 3]);
    });
});
