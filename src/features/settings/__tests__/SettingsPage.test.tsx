import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '../SettingsPage';

vi.mock('../../../lib/documentApi', () => ({
  readAuthSession: vi.fn(),
  exportAccount: vi.fn(),
  deleteAccount: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../../lib/download', () => ({ triggerBlobDownload: vi.fn() }));

vi.mock('../../../lib/navigation', () => ({ hardNavigate: vi.fn() }));

import { deleteAccount, exportAccount, readAuthSession } from '../../../lib/documentApi';
import { triggerBlobDownload } from '../../../lib/download';

const signedInSession = {
  authRequired: false,
  needsSetup: false,
  authenticated: true,
  user: { id: 'u1', email: 'a@example.com', name: null, avatarUrl: null, isAnonymous: false },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports account data', async () => {
    vi.mocked(readAuthSession).mockResolvedValue(signedInSession);
    vi.mocked(exportAccount).mockResolvedValue('{"ok":true}');
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('button', { name: /export data/i }));

    await waitFor(() => expect(exportAccount).toHaveBeenCalled());
    expect(triggerBlobDownload).toHaveBeenCalledWith('docxcraft-export.json', expect.anything());
  });

  it('deletes the account after confirmation', async () => {
    vi.mocked(readAuthSession).mockResolvedValue(signedInSession);
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('button', { name: /delete account/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete everything/i }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
  });

  it('shows the guest notice for anonymous sessions', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      ...signedInSession,
      user: { id: 'g1', email: null, name: null, avatarUrl: null, isAnonymous: true },
    });

    renderPage();

    expect(await screen.findByText(/guest workspace/i)).toBeInTheDocument();
  });
});
