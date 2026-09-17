import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../../test/profileHarness';
import { SecuritySection } from '../sections/SecuritySection';

vi.mock('../../../lib/accountApi', () => ({
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  listActivity: vi.fn(),
}));

import {
  listActivity,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from '../../../lib/accountApi';

const currentSession = {
  id: 's1',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-10-01T00:00:00.000Z',
  ip: '1.2.3.4',
  device: 'Chrome on Windows',
  isCurrent: true,
};

const otherSession = {
  id: 's2',
  createdAt: '2026-09-02T00:00:00.000Z',
  expiresAt: '2026-10-02T00:00:00.000Z',
  ip: '5.6.7.8',
  device: 'Firefox on macOS',
  isCurrent: false,
};

const emptyActivity = { events: [], nextCursor: null };

describe('SecuritySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listActivity).mockResolvedValue(emptyActivity);
  });

  it('marks the current device and shows every session', async () => {
    vi.mocked(listSessions).mockResolvedValue([currentSession, otherSession]);

    renderProfile(<SecuritySection />);

    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText(/this device/i)).toBeInTheDocument();
    expect(screen.getByText('Firefox on macOS')).toBeInTheDocument();
    expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
  });

  it('signs a device out and refreshes the list', async () => {
    vi.mocked(listSessions).mockResolvedValue([currentSession, otherSession]);
    vi.mocked(revokeSession).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderProfile(<SecuritySection />);

    await screen.findByText('Firefox on macOS');
    const signOutButtons = screen.getAllByRole('button', { name: /^sign out$/i });
    await user.click(signOutButtons[1]);

    await waitFor(() => expect(revokeSession).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('signs out every other device', async () => {
    vi.mocked(listSessions).mockResolvedValue([currentSession, otherSession]);
    vi.mocked(revokeOtherSessions).mockResolvedValue({ revoked: 1 });
    const user = userEvent.setup();

    renderProfile(<SecuritySection />);

    await screen.findByText('Firefox on macOS');
    await user.click(screen.getByRole('button', { name: /sign out everywhere else/i }));

    await waitFor(() => expect(revokeOtherSessions).toHaveBeenCalled());
  });

  it('shows an empty state when there are no sign-ins', async () => {
    vi.mocked(listSessions).mockResolvedValue([currentSession]);

    renderProfile(<SecuritySection />);

    expect(await screen.findByText(/no sign-ins recorded yet/i)).toBeInTheDocument();
  });

  it('offers a retry when the activity feed fails', async () => {
    vi.mocked(listSessions).mockResolvedValue([currentSession]);
    vi.mocked(listActivity).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    renderProfile(<SecuritySection />);

    expect(await screen.findByText(/could not load your activity/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(listActivity).toHaveBeenCalledTimes(2));
  });

  it('pages the activity feed with the next cursor', async () => {
    vi.mocked(listSessions).mockResolvedValue([currentSession]);
    vi.mocked(listActivity)
      .mockResolvedValueOnce({
        events: [
          {
            id: 'e1',
            action: 'account.sign_in',
            documentId: null,
            createdAt: '2026-09-10T00:00:00.000Z',
          },
          {
            id: 'e1b',
            action: 'account.sign_in',
            documentId: null,
            createdAt: '2026-09-10T04:00:00.000Z',
          },
        ],
        nextCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        events: [
          {
            id: 'e2',
            action: 'account.sign_in',
            documentId: null,
            createdAt: '2026-09-09T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      });
    const user = userEvent.setup();

    renderProfile(<SecuritySection />);

    await user.click(await screen.findByRole('button', { name: /load more/i }));

    await waitFor(() => expect(listActivity).toHaveBeenCalledWith('cursor-1', 20));
  });
});
