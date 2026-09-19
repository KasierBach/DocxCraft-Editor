import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../../test/profileHarness';
import { ProfilePage } from '../ProfilePage';

vi.mock('../../../lib/documentApi', () => ({
  readAuthSession: vi.fn(),
  listDocuments: vi.fn(),
  exportAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock('../../../lib/accountApi', () => ({
  updateDisplayName: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  listActivity: vi.fn(),
  listProviders: vi.fn(),
  disconnectProvider: vi.fn(),
}));
vi.mock('../../../lib/download', () => ({ triggerBlobDownload: vi.fn() }));
vi.mock('../../../lib/navigation', () => ({ hardNavigate: vi.fn() }));
vi.mock('../../../lib/recoveryStore', () => ({
  readRecoverySnapshot: vi.fn(),
  clearRecoverySnapshot: vi.fn(),
  listRecoverySnapshots: vi.fn(),
}));

import { listActivity, listProviders, listSessions } from '../../../lib/accountApi';
import { listDocuments, readAuthSession } from '../../../lib/documentApi';
import { listRecoverySnapshots, readRecoverySnapshot } from '../../../lib/recoveryStore';

function renderPage(route: string) {
  return renderProfile(
    <Routes>
      <Route path="/settings" element={<ProfilePage />} />
      <Route path="/settings/:section" element={<ProfilePage />} />
    </Routes>,
    { route },
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: true,
      user: {
        id: 'u1',
        email: 'alice@example.com',
        name: 'Alice Baker',
        avatarUrl: null,
        isAnonymous: false,
        createdAt: '2026-01-02T03:04:05.000Z',
      },
    });
    vi.mocked(listDocuments).mockResolvedValue([]);
    vi.mocked(listSessions).mockResolvedValue([]);
    vi.mocked(listActivity).mockResolvedValue({ events: [], nextCursor: null });
    vi.mocked(listProviders).mockResolvedValue([]);
    vi.mocked(readRecoverySnapshot).mockResolvedValue(null);
    vi.mocked(listRecoverySnapshots).mockResolvedValue([]);
  });

  it('falls back to the profile section at /settings', async () => {
    renderPage('/settings');

    expect(await screen.findByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveClass(
      'profile-rail__link--active',
    );
  });

  it('renders the section named in the URL', async () => {
    renderPage('/settings/security');

    expect(await screen.findByRole('heading', { level: 2, name: 'Signed-in devices' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Security' })).toHaveClass(
      'profile-rail__link--active',
    );
  });

  it('falls back to the profile section for an unknown section', async () => {
    renderPage('/settings/unknown');

    expect(await screen.findByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });

  it('summarises the workspace in the header', async () => {
    vi.mocked(readAuthSession).mockResolvedValue({
      authRequired: false,
      needsSetup: false,
      authenticated: true,
      user: {
        id: 'u1',
        email: 'alice@example.com',
        name: 'Alice Baker',
        avatarUrl: 'https://example.com/avatar.png',
        isAnonymous: false,
        createdAt: '2026-01-02T03:04:05.000Z',
      },
    });
    vi.mocked(listDocuments).mockResolvedValue([
      {
        id: 'd1',
        name: 'Report.docx',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-16T00:00:00.000Z',
        sizeInBytes: 2048,
        lastOpenedAt: null,
        versionCount: 3,
        deletedAt: null,
      },
    ]);
    vi.mocked(listProviders).mockResolvedValue([
      { id: 'google', label: 'Google', linkedAt: '2026-01-02T03:04:05.000Z' },
    ]);
    vi.mocked(listRecoverySnapshots).mockResolvedValue([
      {
        sourceKind: 'saved-document',
        documentId: 'd1',
        documentName: 'Report.docx',
        activeParaId: null,
        savedAt: '2026-09-18T10:00:00.000Z',
        buffer: new ArrayBuffer(0),
      },
      {
        sourceKind: 'local-file',
        documentId: null,
        documentName: 'Draft.docx',
        activeParaId: null,
        savedAt: '2026-09-17T10:00:00.000Z',
        buffer: new ArrayBuffer(0),
      },
    ]);

    const { container } = renderProfile(
      <Routes>
        <Route path="/settings" element={<ProfilePage />} />
        <Route path="/settings/:section" element={<ProfilePage />} />
      </Routes>,
      { route: '/settings/profile', providers: [{ id: 'google', label: 'Google' }] },
    );

    expect(await screen.findByText('Alice Baker')).toBeInTheDocument();
    // Proxied through our own origin: Google answers browser hotlinks with a
    // 429 HTML page, which the browser then refuses to render as an image.
    expect(container.querySelector('.profile-avatar__image')).toHaveAttribute(
      'src',
      '/api/account/avatar',
    );
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText(/joined/i)).toBeInTheDocument();
    expect(container.querySelector('.profile-chip')).toHaveTextContent('Google');
    expect(container.querySelector('.profile-chip')).toHaveClass('profile-chip--linked');
    expect(screen.getByText('Unsaved drafts').parentElement).toHaveTextContent('Unsaved drafts2');
  });
});
