import { describe, expect, it } from 'vitest';

import { scanForMedia } from '../mediaScanner';
import type { DocxEditorRef } from '@eigenpal/docx-editor-react';

type TestNode = {
    type: { name: string };
    attrs?: Record<string, unknown>;
    children?: TestNode[];
};

type TestResolvedPos = {
    depth: number;
    node: (depth: number) => TestNode;
};

function node(name: string, attrs?: Record<string, unknown>, children?: TestNode[]): TestNode {
    return { type: { name }, attrs, children };
}

function createEditorRef(root: TestNode | null, resolve?: (position: number) => TestResolvedPos): DocxEditorRef {
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
                            resolve,
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
                position: expect.any(Number),
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

    it('numbers tables sequentially and keeps media without a paragraph id', () => {
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
                position: expect.any(Number),
                paragraphIndex: 1,
            },
            {
                id: expect.stringMatching(/^table-/),
                type: 'table',
                label: 'Table 2',
                paraId: null,
                position: expect.any(Number),
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

    it('resolves the containing paragraph instead of using the image id', () => {
        const paragraph = node('paragraph', { paraId: 'para-1' }, [node('image', { id: 'image-node-1' })]);
        const editor = createEditorRef(
            node('doc', undefined, [paragraph]),
            () => ({ depth: 1, node: (depth) => (depth === 1 ? paragraph : node('doc')) }),
        );

        expect(scanForMedia(editor)[0]).toMatchObject({ paraId: 'para-1', position: 2 });
    });

    it('keeps a position fallback when no paragraph anchor exists', () => {
        const media = scanForMedia(createEditorRef(node('doc', undefined, [node('image', { id: 'image-node-1' })])));

        expect(media[0]).toMatchObject({ paraId: null, position: 1 });
    });
});
