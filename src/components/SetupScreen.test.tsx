import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SetupScreen } from './SetupScreen';

vi.mock('../lib/documentApi', () => ({
  claimInstanceWithPassphrase: vi.fn(),
}));

import { claimInstanceWithPassphrase } from '../lib/documentApi';

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, passphrase: string) {
  await user.type(screen.getByLabelText('Passphrase'), passphrase);
  await user.type(screen.getByLabelText('Repeat passphrase'), passphrase);
  await user.click(screen.getByRole('button', { name: /save passphrase and start/i }));
}

describe('SetupScreen', () => {
  beforeEach(() => {
    vi.mocked(claimInstanceWithPassphrase).mockReset();
  });

  it('keeps submit disabled until a matching passphrase is entered', async () => {
    const user = userEvent.setup();
    render(<SetupScreen onClaimed={() => undefined} />);

    const submit = screen.getByRole('button', { name: /save passphrase and start/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Passphrase'), 'short');
    expect(submit).toBeDisabled();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Passphrase'));
    await user.type(screen.getByLabelText('Passphrase'), 'a-long-passphrase');
    await user.type(screen.getByLabelText('Repeat passphrase'), 'different-passphrase');
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(screen.getByLabelText('Repeat passphrase'));
    await user.type(screen.getByLabelText('Repeat passphrase'), 'a-long-passphrase');
    expect(submit).toBeEnabled();
  });

  it('claims the instance and reports success', async () => {
    vi.mocked(claimInstanceWithPassphrase).mockResolvedValue(undefined);
    const onClaimed = vi.fn();
    const user = userEvent.setup();

    render(<SetupScreen onClaimed={onClaimed} />);
    await fillAndSubmit(user, 'a-long-passphrase');

    await waitFor(() => {
      expect(onClaimed).toHaveBeenCalledTimes(1);
    });
    expect(claimInstanceWithPassphrase).toHaveBeenCalledWith('a-long-passphrase');
  });

  it('surfaces a server error and lets the user retry', async () => {
    vi.mocked(claimInstanceWithPassphrase).mockRejectedValue(
      new Error('This instance is already claimed.'),
    );
    const onClaimed = vi.fn();
    const user = userEvent.setup();

    render(<SetupScreen onClaimed={onClaimed} />);
    await fillAndSubmit(user, 'a-long-passphrase');

    expect(await screen.findByRole('alert')).toHaveTextContent('already claimed');
    expect(onClaimed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save passphrase and start/i })).toBeEnabled();
  });
});
