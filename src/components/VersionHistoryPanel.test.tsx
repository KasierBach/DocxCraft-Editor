import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VersionHistoryPanel } from './VersionHistoryPanel';

describe('VersionHistoryPanel', () => {
  it('renders versions and triggers restore/download actions', async () => {
    let resolveRestore!: () => void;
    const restorePromise = new Promise<void>((resolve) => {
      resolveRestore = resolve;
    });

    const onRestore = vi.fn(() => restorePromise);
    const onDownload = vi.fn();
    const user = userEvent.setup();

    render(
      <VersionHistoryPanel
        documentName="Proposal.docx"
        documentId="doc-1"
        isLoading={false}
        versions={[
          {
            id: 'ver-2',
            documentId: 'doc-1',
            name: 'Proposal Final.docx',
            createdAt: '2026-05-25T05:22:00.000Z',
            sizeInBytes: 2048,
          },
          {
            id: 'ver-1',
            documentId: 'doc-1',
            name: 'Proposal.docx',
            createdAt: '2026-05-25T05:21:00.000Z',
            sizeInBytes: 1024,
          },
        ]}
        onRestore={onRestore}
        onDownload={onDownload}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /download version from/i })[0]!);
    expect(onDownload).toHaveBeenCalledWith('doc-1', 'ver-2');

    await user.click(screen.getAllByRole('button', { name: /restore version from/i })[0]!);
    expect(onRestore).toHaveBeenCalledWith('doc-1', 'ver-2');
    expect(screen.getByText(/restoring\.\.\./i)).toBeInTheDocument();

    resolveRestore();

    await waitFor(() => {
      expect(screen.queryByText(/restoring\.\.\./i)).not.toBeInTheDocument();
    });
  });
});
