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
vi.mock('../../profile/ProfilePage', () => ({
  ProfilePage: () => <div data-testid="profile" />,
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

  it('renders the profile page at /settings and its sections', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: true,
    });

    renderGate('/settings/security');

    expect(await screen.findByTestId('profile')).toBeInTheDocument();
  });

  it('shows the hosted sign-in page at /login when providers exist', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: false,
      providers: [{ id: 'google', label: 'Google' }],
      user: {
        id: 'g1',
        email: null,
        name: null,
        avatarUrl: null,
        isAnonymous: true,
        createdAt: '2026-01-02T03:04:05.000Z',
      },
    });

    renderGate('/login');

    expect(await screen.findByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      '/api/auth/google/start',
    );
    expect(
      screen.getByRole('button', { name: /keep editing as a guest/i }),
    ).toBeInTheDocument();
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

  it('reopens the reference page the reader was on after a reload', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: true,
    });
    // What a reload looks like: the overlay is not in the URL, so the session
    // remembers which reference page was open over the app.
    window.sessionStorage.setItem('docxcraft:open-page', 'docs');

    renderGate();
    await screen.findByTestId('probe');

    expect(screen.getByTestId('docs')).toBeInTheDocument();
    // The app still stays mounted underneath the reopened overlay.
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });

  it('remembers the open reference page and forgets it once closed', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: true,
    });
    const user = userEvent.setup();

    renderGate();
    await screen.findByTestId('probe');

    await user.click(screen.getByRole('button', { name: /open docs/i }));
    expect(window.sessionStorage.getItem('docxcraft:open-page')).toBe('docs');

    await user.keyboard('{Escape}');
    expect(window.sessionStorage.getItem('docxcraft:open-page')).toBeNull();
  });

  it('does not reopen a reference page in a fresh session', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: true,
      needsSetup: false,
      authenticated: true,
    });
    window.sessionStorage.clear();

    renderGate();
    await screen.findByTestId('probe');

    expect(screen.queryByTestId('docs')).not.toBeInTheDocument();
  });
});
