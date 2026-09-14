import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AuthGate } from '../AuthGate';
import { useAuthGate } from '../AuthGateContext';

vi.mock('../../../lib/documentApi', () => ({
  readAuthSession: vi.fn(),
}));

vi.mock('../../landing/LandingPage', () => ({
  LandingPage: ({ needsSetup }: { needsSetup: boolean }) => (
    <div data-testid="landing">{needsSetup ? 'needs-setup' : 'ready'}</div>
  ),
}));
vi.mock('../LoginScreen', () => ({ LoginScreen: () => <div data-testid="login" /> }));
vi.mock('../SetupScreen', () => ({ SetupScreen: () => <div data-testid="setup" /> }));
vi.mock('../../landing/PrivacyPolicy', () => ({ PrivacyPolicy: () => <div /> }));
vi.mock('../../landing/TermsOfUse', () => ({ TermsOfUse: () => <div /> }));
vi.mock('../../landing/DocsPage', () => ({ DocsPage: () => <div data-testid="docs" /> }));
vi.mock('../../landing/ChangelogPage', () => ({ ChangelogPage: () => <div /> }));
vi.mock('../../library/DocumentsPage', () => ({
  DocumentsPage: () => <div data-testid="library" />,
}));

import { readAuthSession } from '../../../lib/documentApi';

function Probe() {
  const { isAuthGated, openPage, closePage } = useAuthGate();
  return (
    <div>
      <span data-testid="probe">{isAuthGated ? 'gated' : 'open'}</span>
      <button type="button" onClick={() => openPage('docs')}>
        open docs
      </button>
      <button type="button" onClick={closePage}>
        close page
      </button>
    </div>
  );
}

function renderGate(path = '/app') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthGate>
        <Probe />
      </AuthGate>
    </MemoryRouter>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.mocked(readAuthSession).mockReset();
  });

  it('renders the app at /app when auth is disabled', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: true,
    });

    renderGate();

    expect(await screen.findByTestId('probe')).toHaveTextContent('open');
    expect(screen.queryByTestId('landing')).not.toBeInTheDocument();
  });

  it('shows the landing page at / for a fresh instance', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: true,
      authenticated: false,
    });

    renderGate('/');

    // Landing is unreachable until the instance is claimed; setup comes first.
    expect(await screen.findByTestId('setup')).toBeInTheDocument();
  });

  it('shows sign-in for a claimed instance without a session', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: false,
    });

    renderGate('/');

    expect(await screen.findByTestId('login')).toBeInTheDocument();
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

  it('renders the documents library at /documents', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: true,
    });

    renderGate('/documents');

    expect(await screen.findByTestId('library')).toBeInTheDocument();
  });

  it('opens reference pages over the running app and closes them with Escape', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: true,
    });
    const user = userEvent.setup();

    renderGate();
    await screen.findByTestId('probe');

    await user.click(screen.getByRole('button', { name: /open docs/i }));

    expect(screen.getByTestId('docs')).toBeInTheDocument();
    // The app stays mounted underneath the overlay.
    expect(screen.getByTestId('probe')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('docs')).not.toBeInTheDocument();
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });
});
