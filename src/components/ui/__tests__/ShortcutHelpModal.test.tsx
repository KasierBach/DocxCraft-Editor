import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ShortcutHelpModal } from '../ShortcutHelpModal';

const TEST_SHORTCUTS = [
    { keys: ['Ctrl', 'S'], description: 'Save current document' },
    { keys: ['Ctrl', 'Shift', 'S'], description: 'Save as new document' },
    { keys: ['Ctrl', '/'], description: 'Show or hide this help' },
];

function renderModal(overrides?: Partial<{ isOpen: boolean; onClose: () => void }>) {
    const onClose = vi.fn();
    render(
        <ShortcutHelpModal
            isOpen={overrides?.isOpen ?? true}
            onClose={overrides?.onClose ?? onClose}
            shortcuts={TEST_SHORTCUTS}
        />,
    );
    return { onClose };
}

describe('ShortcutHelpModal', () => {
    it('renders nothing when closed', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
    });

    it('lists the provided shortcuts', () => {
        renderModal();

        expect(screen.getByText('Save current document')).toBeInTheDocument();
        expect(screen.getByText('Save as new document')).toBeInTheDocument();
        expect(screen.getByText('Show or hide this help')).toBeInTheDocument();
    });

    it('renders key caps with plus separators', () => {
        renderModal();

        const keyCaps = screen.getAllByText('Ctrl');
        expect(keyCaps.length).toBeGreaterThan(0);
        expect(screen.getAllByText('+').length).toBeGreaterThan(0);
    });

    it('closes via the close button', async () => {
        const onClose = vi.fn();
        renderModal({ onClose });
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /close keyboard shortcuts/i }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', () => {
        const onClose = vi.fn();
        renderModal({ onClose });

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when clicking the overlay backdrop', async () => {
        const onClose = vi.fn();
        renderModal({ onClose });

        const dialog = screen.getByRole('dialog', { name: /keyboard shortcuts/i });
        const overlay = dialog.parentElement!;
        fireEvent.mouseDown(overlay, { target: overlay });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    it('traps Tab focus inside the dialog', () => {
        renderModal();

        const dialog = screen.getByRole('dialog', { name: /keyboard shortcuts/i });
        const closeButton = screen.getByRole('button', { name: /close keyboard shortcuts/i });
        closeButton.focus();

        fireEvent.keyDown(dialog, { key: 'Tab' });

        expect(document.activeElement).toBe(closeButton);
    });
});
