import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '../CommandPalette';
import type { SavedDocumentSummary } from '../../../lib/documentApi';

const DOCUMENTS: SavedDocumentSummary[] = [
    {
        id: 'doc-1',
        name: 'Quarterly Report.docx',
        createdAt: '2026-05-25T05:00:00.000Z',
        updatedAt: '2026-05-25T05:00:00.000Z',
        sizeInBytes: 1024,
        lastOpenedAt: null,
        versionCount: 1,
        deletedAt: null,
    },
    {
        id: 'doc-2',
        name: 'Meeting Notes.docx',
        createdAt: '2026-05-25T05:10:00.000Z',
        updatedAt: '2026-05-25T05:10:00.000Z',
        sizeInBytes: 2048,
        lastOpenedAt: null,
        versionCount: 2,
        deletedAt: null,
    },
];

const ANCHORS = [
    { id: 'para-1', label: 'Introduction' },
    { id: 'para-2', label: 'Conclusion' },
];

function renderPalette(overrides?: Partial<Parameters<typeof CommandPalette>[0]>) {
    const onClose = vi.fn();
    const onOpenDocument = vi.fn();
    const onJumpToAnchor = vi.fn();
    const saveAction = vi.fn();

    const props = {
        isOpen: true,
        onClose,
        documents: DOCUMENTS,
        anchors: ANCHORS,
        actions: [{ id: 'save', label: 'Save document', section: 'Actions', handler: saveAction }],
        onOpenDocument,
        onJumpToAnchor,
        ...overrides,
    };

    render(<CommandPalette {...props} />);

    return { onClose, onOpenDocument, onJumpToAnchor, saveAction, props };
}

function key(keyName: string) {
    act(() => {
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }),
        );
    });
}

describe('CommandPalette', () => {
    it('renders nothing when closed', () => {
        renderPalette({ isOpen: false });
        expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument();
    });

    it('lists actions, documents, and anchors when open', () => {
        renderPalette();

        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        expect(screen.getByText('Save document')).toBeInTheDocument();
        expect(screen.getByText('Quarterly Report.docx')).toBeInTheDocument();
        expect(screen.getByText('Meeting Notes.docx')).toBeInTheDocument();
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Conclusion')).toBeInTheDocument();
    });

    it('filters results by query case-insensitively', async () => {
        renderPalette();
        const user = userEvent.setup();

        await user.type(screen.getByRole('combobox', { name: /search commands/i }), 'quarterly');

        expect(screen.getByText('Quarterly Report.docx')).toBeInTheDocument();
        expect(screen.queryByText('Meeting Notes.docx')).not.toBeInTheDocument();
        expect(screen.queryByText('Save document')).not.toBeInTheDocument();
    });

    it('shows an empty state when nothing matches', async () => {
        renderPalette();
        const user = userEvent.setup();

        await user.type(screen.getByRole('combobox', { name: /search commands/i }), 'zzzz');

        expect(screen.getByText(/no results for/i)).toBeInTheDocument();
    });

    it('caps anchors at eight entries', () => {
        const manyAnchors = Array.from({ length: 12 }, (_, index) => ({
            id: `para-${index}`,
            label: `Anchor ${index}`,
        }));
        renderPalette({ anchors: manyAnchors });

        const options = screen.getAllByRole('option');
        expect(options.filter((option) => option.textContent?.includes('Anchor'))).toHaveLength(8);
    });

    it('opens a document when its result is clicked', async () => {
        const { onClose, onOpenDocument } = renderPalette();
        const user = userEvent.setup();

        await user.click(screen.getByRole('option', { name: /quarterly report\.docx/i }));

        expect(onOpenDocument).toHaveBeenCalledWith('doc-1');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('jumps to an anchor when its result is selected', async () => {
        const { onJumpToAnchor, onClose } = renderPalette();
        const user = userEvent.setup();

        await user.click(screen.getByRole('option', { name: /outlineintroduction/i }));

        expect(onJumpToAnchor).toHaveBeenCalledWith('para-1');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('runs the action handler when an action result is selected', async () => {
        const { saveAction, onClose } = renderPalette();
        const user = userEvent.setup();

        await user.click(screen.getByRole('option', { name: /save document/i }));

        expect(saveAction).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('navigates with arrow keys and selects with Enter', () => {
        const { onOpenDocument } = renderPalette();

        key('ArrowDown');
        key('Enter');

        expect(onOpenDocument).toHaveBeenCalledWith('doc-1');
    });

    it('wraps around when navigating past the last result', () => {
        renderPalette();

        const options = screen.getAllByRole('option');
        const lastIndex = options.length - 1;
        for (let step = 0; step < lastIndex; step += 1) {
            key('ArrowDown');
        }

        expect(screen.getAllByRole('option')[lastIndex]).toHaveAttribute('aria-selected', 'true');

        key('ArrowDown');
        expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('closes on Escape', () => {
        const { onClose } = renderPalette();

        key('Escape');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when clicking the overlay backdrop', async () => {
        const { onClose } = renderPalette();

        const dialog = screen.getByRole('dialog', { name: /command palette/i });
        const overlay = dialog.parentElement!;
        fireEvent.mouseDown(overlay, { target: overlay });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    it('resets the selection to the first result when the query changes', async () => {
        renderPalette();
        const user = userEvent.setup();

        key('ArrowDown');
        const options = screen.getAllByRole('option');
        expect(options[1]).toHaveAttribute('aria-selected', 'true');

        await user.type(screen.getByRole('combobox', { name: /search commands/i }), 'meeting');

        const filtered = screen.getAllByRole('option');
        expect(filtered[0]).toHaveAttribute('aria-selected', 'true');
    });
});
