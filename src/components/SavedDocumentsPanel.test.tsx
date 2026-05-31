import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SavedDocumentsPanel } from './SavedDocumentsPanel';

const DOCUMENTS = [
  {
    id: 'doc-1',
    name: 'Proposal Final.docx',
    createdAt: '2026-05-25T05:20:00.000Z',
    updatedAt: '2026-05-25T05:21:00.000Z',
    sizeInBytes: 1024,
    lastOpenedAt: '2026-05-25T05:25:00.000Z',
    versionCount: 2,
  },
  {
    id: 'doc-2',
    name: 'Contract Draft.docx',
    createdAt: '2026-05-25T05:18:00.000Z',
    updatedAt: '2026-05-25T05:19:00.000Z',
    sizeInBytes: 2048,
    lastOpenedAt: null,
    versionCount: 1,
  },
] as const;

describe('SavedDocumentsPanel', () => {
  it('renders saved documents, opens a document, and supports duplicate/download actions', async () => {
    const onOpen = vi.fn();
    const onRefresh = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onDownload = vi.fn();
    const user = userEvent.setup();

    render(
      <SavedDocumentsPanel
        documents={[...DOCUMENTS]}
        currentDocumentId="doc-2"
        isLoading={false}
        onOpen={onOpen}
        onRefresh={onRefresh}
        onRename={onRename}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onDownload={onDownload}
      />,
    );

    expect(screen.getAllByText(/recent/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /open proposal final\.docx/i }));
    await user.click(screen.getByRole('button', { name: /download proposal final\.docx/i }));
    await user.click(screen.getByRole('button', { name: /duplicate proposal final\.docx/i }));

    expect(onOpen).toHaveBeenCalledWith('doc-1');
    expect(onDownload).toHaveBeenCalledWith('doc-1');
    expect(onDuplicate).toHaveBeenCalledWith('doc-1');
    expect(screen.getByRole('button', { name: /open contract draft\.docx/i })).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  it('filters documents by search and renames a saved document', async () => {
    const onOpen = vi.fn();
    const onRefresh = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onDownload = vi.fn();
    const user = userEvent.setup();

    render(
      <SavedDocumentsPanel
        documents={[...DOCUMENTS]}
        currentDocumentId="doc-1"
        isLoading={false}
        onOpen={onOpen}
        onRefresh={onRefresh}
        onRename={onRename}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onDownload={onDownload}
      />,
    );

    await user.type(screen.getByLabelText(/search saved documents/i), 'contract');

    expect(screen.queryByText(/proposal final\.docx/i)).not.toBeInTheDocument();
    expect(screen.getByText(/contract draft\.docx/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/search saved documents/i));
    await user.click(screen.getAllByRole('button', { name: /rename proposal final\.docx/i })[0]!);
    await user.clear(screen.getAllByLabelText(/edit name for proposal final\.docx/i)[0]!);
    await user.type(
      screen.getAllByLabelText(/edit name for proposal final\.docx/i)[0]!,
      'Proposal Final v2.docx',
    );
    await user.click(screen.getAllByRole('button', { name: /save name for proposal final\.docx/i })[0]!);

    expect(onRename).toHaveBeenCalledWith('doc-1', 'Proposal Final v2.docx');
  });

  it('confirms deletion before removing a saved document and shows a pending state', async () => {
    const onOpen = vi.fn();
    const onRefresh = vi.fn();
    const onRename = vi.fn();
    let resolveDelete!: () => void;
    const deleteRequest = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const onDelete = vi.fn(() => deleteRequest);
    const onDuplicate = vi.fn();
    const onDownload = vi.fn();
    const user = userEvent.setup();

    render(
      <SavedDocumentsPanel
        documents={[DOCUMENTS[0]]}
        currentDocumentId="doc-1"
        isLoading={false}
        onOpen={onOpen}
        onRefresh={onRefresh}
        onRename={onRename}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onDownload={onDownload}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /delete proposal final\.docx/i })[0]!);

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/delete this saved document\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm delete proposal final\.docx/i }));

    expect(onDelete).toHaveBeenCalledWith('doc-1');
    expect(screen.getByRole('button', { name: /confirm delete proposal final\.docx/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel delete proposal final\.docx/i })).toBeDisabled();
    expect(screen.getByText(/deleting\.\.\./i)).toBeInTheDocument();

    resolveDelete();

    await waitFor(() => {
      expect(screen.queryByText(/delete this saved document\?/i)).not.toBeInTheDocument();
    });
  });
});
