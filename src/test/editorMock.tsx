import React, { forwardRef } from 'react';
import { vi } from 'vitest';

type MockState = {
    docxEditorRenderLog: Array<{ document?: unknown; documentBuffer?: ArrayBuffer }>;
    editorSave: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
    triggerEditorContentChange: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
    triggerEditorSelectionChange: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
    nextSelectionInfo: {
        paraId: string | null;
        selectedText: string;
        paragraphText: string;
        before: string;
        after: string;
    } | null;
};

const state: MockState = {
    docxEditorRenderLog: [],
    editorSave: vi.fn(),
    triggerEditorContentChange: vi.fn(),
    triggerEditorSelectionChange: vi.fn(),
    nextSelectionInfo: null,
};

export const DocxEditor = forwardRef(function MockDocxEditor(
    props: Record<string, unknown>,
    ref,
) {
    state.docxEditorRenderLog.push({
        document: props.document,
        documentBuffer: props.documentBuffer instanceof ArrayBuffer ? props.documentBuffer : undefined,
    });

    state.triggerEditorContentChange.mockImplementation(() => {
        const onChange = props.onChange as ((document: unknown) => void) | undefined;
        onChange?.({ type: 'changed-document' });
    });

    state.triggerEditorSelectionChange.mockImplementation((selectionState: unknown) => {
        const onSelectionChange = props.onSelectionChange as ((selection: unknown) => void) | undefined;
        onSelectionChange?.(selectionState);
    });

    React.useImperativeHandle(ref, () => ({
        save: state.editorSave,
        getTotalPages: () => 1,
        getPageContent: () => ({ pageNumber: 1, text: '', paragraphs: [] }),
        getAgent: () => ({ getWordCount: () => 0 }),
        getEditorRef: () => null,
        openPrintPreview: vi.fn(),
        getSelectionInfo: () => state.nextSelectionInfo,
        getCurrentPage: () => 1,
        scrollToPage: vi.fn(),
        scrollToParaId: () => true,
    }));

    return (
        <div data-testid="docx-editor">
            <button type="button" onClick={() => state.triggerEditorContentChange()}>
                Simulate content change
            </button>
            <button
                type="button"
                onClick={() =>
                    state.triggerEditorSelectionChange({
                        hasSelection: false,
                        isMultiParagraph: false,
                        textFormatting: {},
                        paragraphFormatting: {},
                        styleId: 'Normal',
                        startParagraphIndex: 1,
                        endParagraphIndex: 1,
                    })
                }
            >
                Simulate selection change
            </button>
        </div>
    );
});

export function createEmptyDocument() {
    return { type: 'demo-document' };
}

export const mockState = state;
