import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AuthGate } from './AuthGate';
import { useAuthGate } from './AuthGateContext';

vi.mock('../lib/documentApi', () => ({
  readAuthSession: vi.fn(),
}));

vi.mock('./LandingPage', () => ({
  LandingPage: ({ needsSetup }: { needsSetup: boolean }) => (
    <div data-testid="landing">{needsSetup ? 'needs-setup' : 'ready'}</div>
  ),
}));
vi.mock('./LoginScreen', () => ({ LoginScreen: () => <div data-testid="login" /> }));
vi.mock('./SetupScreen', () => ({ SetupScreen: () => <div data-testid="setup" /> }));
vi.mock('./PrivacyPolicy', () => ({ PrivacyPolicy: () => <div /> }));
vi.mock('./TermsOfUse', () => ({ TermsOfUse: () => <div /> }));
vi.mock('./DocsPage', () => ({ DocsPage: () => <div /> }));
vi.mock('./ChangelogPage', () => ({ ChangelogPage: () => <div /> }));

import { readAuthSession } from '../lib/documentApi';

function Probe() {
  const { isAuthGated } = useAuthGate();
  return <span data-testid="probe">{isAuthGated ? 'gated' : 'open'}</span>;
}

function renderGate() {
  return render(
    <AuthGate>
      <Probe />
    </AuthGate>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.mocked(readAuthSession).mockReset();
  });

  it('renders the app directly when auth is disabled', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: true,
    });

    renderGate();

    expect(await screen.findByTestId('probe')).toHaveTextContent('open');
    expect(screen.queryByTestId('landing')).not.toBeInTheDocument();
  });

  it('shows the landing page with setup pending for a fresh instance', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: true,
      authenticated: false,
    });

    renderGate();

    expect(await screen.findByTestId('landing')).toHaveTextContent('needs-setup');
  });

  it('shows the landing page for a claimed instance without a session', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: false,
    });

    renderGate();

    expect(await screen.findByTestId('landing')).toHaveTextContent('ready');
  });

  it('falls through to the app when the session check fails', async () => {
    vi.mocked(readAuthSession).mockRejectedValue(new Error('offline'));

    renderGate();

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toBeInTheDocument();
    });
  });

  it('tells children the instance is gated', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: true,
    });

    renderGate();

    expect(await screen.findByTestId('probe')).toHaveTextContent('gated');
  });
});
