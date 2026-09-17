import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../../test/profileHarness';
import { ProfileSection } from '../sections/ProfileSection';

vi.mock('../../../lib/accountApi', () => ({ updateDisplayName: vi.fn() }));
vi.mock('../../../lib/documentApi', () => ({ readAuthSession: vi.fn() }));

import { updateDisplayName } from '../../../lib/accountApi';
import { readAuthSession } from '../../../lib/documentApi';

const signedInSession = {
  authRequired: false,
  needsSetup: false,
  authenticated: true,
  user: {
    id: 'u1',
    email: 'alice@example.com',
    name: 'Alice Baker',
    avatarUrl: null,
    isAnonymous: false,
  },
};

describe('ProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the editable display name for signed-in users', async () => {
    vi.mocked(readAuthSession).mockResolvedValue(signedInSession);

    renderProfile(<ProfileSection />);

    expect(await screen.findByLabelText(/display name/i)).toHaveValue('Alice Baker');
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows the upgrade prompt instead of the form for guests', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      ...signedInSession,
      user: { id: 'g1', email: null, name: null, avatarUrl: null, isAnonymous: true },
    });

    renderProfile(<ProfileSection />, {
      isAnonymous: true,
      providers: [{ id: 'google', label: 'Google' }],
    });

    expect(
      await screen.findByRole('link', { name: /continue with google/i }),
    ).toHaveAttribute('href', '/api/auth/google/start');
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
  });

  it('saves a valid display name and confirms it', async () => {
    vi.mocked(readAuthSession).mockResolvedValue(signedInSession);
    vi.mocked(updateDisplayName).mockResolvedValue({
      ...signedInSession.user,
      name: 'Alice B.',
    });
    const user = userEvent.setup();

    renderProfile(<ProfileSection />);

    const input = await screen.findByLabelText(/display name/i);
    await user.clear(input);
    await user.type(input, 'Alice B.');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateDisplayName).toHaveBeenCalledWith('Alice B.'));
    expect(await screen.findByText(/display name updated/i)).toBeInTheDocument();
  });

  it('keeps the typed value and shows the server message when the name is rejected', async () => {
    vi.mocked(readAuthSession).mockResolvedValue(signedInSession);
    vi.mocked(updateDisplayName).mockRejectedValue(
      new Error('A display name of 1 to 80 characters is required.'),
    );
    const user = userEvent.setup();

    renderProfile(<ProfileSection />);

    const input = await screen.findByLabelText(/display name/i);
    await user.clear(input);
    await user.type(input, 'A name the server rejects');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/1 to 80 characters/i);
    expect(input).toHaveValue('A name the server rejects');
  });
});
