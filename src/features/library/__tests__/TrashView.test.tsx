import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TrashView } from '../TrashView';

vi.mock('../../../lib/documentApi', () => ({
  listTrash: vi.fn(),
  restoreDocument: vi.fn(),
  purgeDocument: vi.fn(),
}));

import { listTrash, purgeDocument, restoreDocument } from '../../../lib/documentApi';

const trashedDocument = {
  id: 'd1',
  name: 'Old Report.docx',
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
  sizeInBytes: 2048,
  lastOpenedAt: null,
  versionCount: 3,
  deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

function renderTrash() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TrashView />
    </QueryClientProvider>,
  );
}

describe('TrashView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists trashed documents with size, version count, and deletion time', async () => {
    vi.mocked(listTrash).mockResolvedValue([trashedDocument]);

    renderTrash();

    expect(await screen.findByText('Old Report.docx')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/versions 3/i)).toBeInTheDocument();
    expect(screen.getByText(/deleted/i)).toBeInTheDocument();
  });

  it('shows an empty state when the trash is empty', async () => {
    vi.mocked(listTrash).mockResolvedValue([]);

    renderTrash();

    expect(await screen.findByText(/trash is empty/i)).toBeInTheDocument();
  });

  it('shows an error state and retries', async () => {
    vi.mocked(listTrash).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    const user = userEvent.setup();

    renderTrash();

    expect(await screen.findByText(/could not load trashed documents/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(listTrash).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/trash is empty/i)).toBeInTheDocument();
  });

  it('restores a trashed document', async () => {
    vi.mocked(listTrash).mockResolvedValue([trashedDocument]);
    vi.mocked(restoreDocument).mockResolvedValue({ ...trashedDocument, deletedAt: null });
    const user = userEvent.setup();

    renderTrash();
    await screen.findByText('Old Report.docx');

    await user.click(screen.getByRole('button', { name: /restore old report\.docx/i }));

    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith('d1'));
  });

  it('deletes a document forever only after an explicit confirmation', async () => {
    vi.mocked(listTrash).mockResolvedValue([trashedDocument]);
    vi.mocked(purgeDocument).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderTrash();
    await screen.findByText('Old Report.docx');

    await user.click(screen.getByRole('button', { name: /delete old report\.docx forever/i }));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(purgeDocument).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: /confirm delete old report\.docx forever/i }),
    );

    await waitFor(() => expect(purgeDocument).toHaveBeenCalledWith('d1'));
  });
});
