import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../test/profileHarness';
import { WorkspaceCollaborationPanel } from '../WorkspaceCollaborationPanel';

vi.mock('../../lib/workspaceApi', () => ({
  addDocumentComment: vi.fn(),
  deleteDocumentShare: vi.fn(),
  listDocumentComments: vi.fn(),
  listDocumentShares: vi.fn(),
  resolveDocumentComment: vi.fn(),
  upsertDocumentShare: vi.fn(),
}));

import {
  addDocumentComment,
  deleteDocumentShare,
  listDocumentComments,
  listDocumentShares,
  resolveDocumentComment,
  upsertDocumentShare,
} from '../../lib/workspaceApi';

describe('WorkspaceCollaborationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDocumentShares).mockResolvedValue([{ id: 's1', email: 'viewer@example.com', role: 'viewer', createdAt: '2026-09-20T00:00:00.000Z' }]);
    vi.mocked(listDocumentComments).mockResolvedValue([
      { id: 'c1', documentId: 'd1', authorId: 'u1', authorName: 'Alice', parentId: null, paraId: null, body: 'Please review this', resolvedAt: null, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' },
    ]);
    vi.mocked(upsertDocumentShare).mockResolvedValue({ id: 's2', email: 'editor@example.com', role: 'editor', createdAt: '2026-09-20T00:00:00.000Z' });
    vi.mocked(deleteDocumentShare).mockResolvedValue(undefined);
    vi.mocked(addDocumentComment).mockResolvedValue({ id: 'c2', documentId: 'd1', authorId: 'u1', authorName: 'Alice', parentId: null, paraId: null, body: 'New note', resolvedAt: null, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' });
    vi.mocked(resolveDocumentComment).mockResolvedValue({ id: 'c1', documentId: 'd1', authorId: 'u1', authorName: 'Alice', parentId: null, paraId: null, body: 'Please review this', resolvedAt: '2026-09-20T00:00:00.000Z', createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' });
  });

  it('shows the empty state until a document is saved', () => {
    renderProfile(<WorkspaceCollaborationPanel documentId={null} activeParaId={null} />);
    expect(screen.getByText(/save a document to share/i)).toBeInTheDocument();
  });

  it('shares, removes, comments without an anchor, and resolves a review thread', async () => {
    const user = userEvent.setup();
    renderProfile(<WorkspaceCollaborationPanel documentId="d1" activeParaId={null} />);

    expect(await screen.findByText('viewer@example.com')).toBeInTheDocument();
    expect(screen.getByText('Please review this')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Share with email' }), 'editor@example.com');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Share role' }), 'editor');
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(upsertDocumentShare).toHaveBeenCalledWith('d1', 'editor@example.com', 'editor'));

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(deleteDocumentShare).toHaveBeenCalledWith('d1', 's1'));

    await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'New note');
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    await waitFor(() => expect(addDocumentComment).toHaveBeenCalledWith('d1', { body: 'New note', paraId: null }));

    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(resolveDocumentComment).toHaveBeenCalledWith('c1', true));
  });
});
