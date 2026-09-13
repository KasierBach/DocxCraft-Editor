import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { LoginScreen } from './LoginScreen';

vi.mock('../lib/documentApi', () => ({
  loginWithPassphrase: vi.fn(),
}));

import { loginWithPassphrase } from '../lib/documentApi';

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.mocked(loginWithPassphrase).mockReset();
  });

  it('renders the passphrase form', () => {
    render(<LoginScreen onAuthenticated={() => undefined} />);

    expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/passphrase/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled();
    expect(screen.getByText(/data\/auth\.json/i)).toBeInTheDocument();
  });

  it('unlocks after a successful login', async () => {
    vi.mocked(loginWithPassphrase).mockResolvedValue(undefined);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/passphrase/i), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
    expect(loginWithPassphrase).toHaveBeenCalledWith('correct horse battery staple');
  });

  it('shows the server error for a wrong passphrase', async () => {
    vi.mocked(loginWithPassphrase).mockRejectedValue(new Error('Incorrect passphrase.'));
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/passphrase/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect passphrase.');
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('submits via Enter and allows retrying after a failure', async () => {
    vi.mocked(loginWithPassphrase)
      .mockRejectedValueOnce(new Error('Incorrect passphrase.'))
      .mockResolvedValueOnce(undefined);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    const input = screen.getByLabelText(/passphrase/i);
    await user.type(input, 'wrong');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'correct horse battery staple');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });
});
