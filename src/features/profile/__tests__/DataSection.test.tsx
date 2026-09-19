import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../../test/profileHarness';
import { DataSection } from '../sections/DataSection';

vi.mock('../../../lib/accountApi', () => ({ listActivity: vi.fn() }));
vi.mock('../../../lib/documentApi', () => ({
  listDocuments: vi.fn(),
  exportAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock('../../../lib/download', () => ({ triggerBlobDownload: vi.fn() }));
vi.mock('../../../lib/navigation', () => ({ hardNavigate: vi.fn() }));
vi.mock('../../../lib/recoveryStore', () => ({
  readRecoverySnapshot: vi.fn(),
  clearRecoverySnapshot: vi.fn(),
}));

import { listActivity } from '../../../lib/accountApi';
import { deleteAccount, exportAccount, listDocuments } from '../../../lib/documentApi';
import { triggerBlobDownload } from '../../../lib/download';
import { clearRecoverySnapshot, readRecoverySnapshot } from '../../../lib/recoveryStore';

const snapshot = {
  sourceKind: 'sample' as const,
  documentId: null,
  documentName: 'Draft.docx',
  activeParaId: null,
  savedAt: '2026-09-15T10:00:00.000Z',
  buffer: new ArrayBuffer(4),
};

describe('DataSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDocuments).mockResolvedValue([]);
    vi.mocked(listActivity).mockResolvedValue({ events: [], nextCursor: null });
    vi.mocked(readRecoverySnapshot).mockResolvedValue(null);
  });

  it('exports account data', async () => {
    vi.mocked(exportAccount).mockResolvedValue('{"ok":true}');
    const user = userEvent.setup();

    renderProfile(<DataSection />);
    await user.click(await screen.findByRole('button', { name: /export data/i }));

    await waitFor(() => expect(exportAccount).toHaveBeenCalled());
    expect(triggerBlobDownload).toHaveBeenCalledWith('docxcraft-export.json', expect.anything());
  });

  it('shows when the account was last exported', async () => {
    vi.mocked(listActivity).mockResolvedValue({
      events: [
        {
          id: 'e1',
          action: 'account.export',
          documentId: null,
          metadata: null,
          createdAt: '2026-09-16T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    renderProfile(<DataSection />);

    expect(await screen.findByText(/last exported/i)).toBeInTheDocument();
  });

  it('discards an unsaved recovery draft', async () => {
    vi.mocked(readRecoverySnapshot).mockResolvedValue(snapshot);
    const user = userEvent.setup();

    renderProfile(<DataSection />);

    expect(await screen.findByText(/draft\.docx/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /discard draft/i }));

    await waitFor(() => expect(clearRecoverySnapshot).toHaveBeenCalledWith(snapshot));
  });

  it('deletes the account after confirmation', async () => {
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderProfile(<DataSection />);

    await user.click(await screen.findByRole('button', { name: /delete account/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete everything/i }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
  });
});
