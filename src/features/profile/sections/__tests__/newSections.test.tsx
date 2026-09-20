import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderProfile } from '../../../../test/profileHarness';
import { AiSettingsSection } from '../AiSettingsSection';
import { NotificationsSection } from '../NotificationsSection';
import { TemplatesSection } from '../TemplatesSection';
import { WorkspaceToolsPanel } from '../WorkspaceToolsPanel';

vi.mock('../../../../lib/workspaceApi', () => ({
  getAiSettings: vi.fn(),
  updateAiSettings: vi.fn(),
  listWorkspaceNotifications: vi.fn(),
  markWorkspaceNotificationsRead: vi.fn(),
  importDocumentUrl: vi.fn(),
  listWorkspaceDocuments: vi.fn(),
  updateWorkspaceDocument: vi.fn(),
  bulkUpdateWorkspaceDocuments: vi.fn(),
}));

import {
  bulkUpdateWorkspaceDocuments,
  getAiSettings,
  importDocumentUrl,
  listWorkspaceDocuments,
  listWorkspaceNotifications,
  markWorkspaceNotificationsRead,
  updateAiSettings,
  updateWorkspaceDocument,
} from '../../../../lib/workspaceApi';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe('new profile sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAiSettings).mockResolvedValue({
      enabled: true,
      provider: 'openai-compatible',
      model: 'gpt-test',
      baseUrl: 'https://api.example.com/v1',
      keySource: 'operator-env',
      apiKeyConfigured: true,
      usage: { requests: 2, inputTokens: 10, outputTokens: 4, windowStarted: '2026-09-20T10:00:00.000Z' },
      maxRequestsPerHour: 30,
    });
    vi.mocked(updateAiSettings).mockResolvedValue({ provider: 'openai-compatible', model: 'gpt-next', baseUrl: 'https://api.example.com/v1', enabled: false });
    vi.mocked(listWorkspaceNotifications).mockResolvedValue([
      { id: 'n1', type: 'document.shared', payload: null, readAt: null, createdAt: '2026-09-20T10:00:00.000Z' },
      { id: 'n2', type: 'comment.added', payload: null, readAt: '2026-09-20T11:00:00.000Z', createdAt: '2026-09-20T11:00:00.000Z' },
    ]);
    vi.mocked(markWorkspaceNotificationsRead).mockResolvedValue(undefined);
    vi.mocked(importDocumentUrl).mockResolvedValue({ id: 'd-imported', name: 'Imported.docx' });
    vi.mocked(listWorkspaceDocuments).mockResolvedValue([
      { id: 'd1', name: 'Report.docx', folder: null, tags: [], isStarred: false, updatedAt: '2026-09-20T00:00:00.000Z', sizeInBytes: 200, role: 'owner' },
    ]);
    vi.mocked(updateWorkspaceDocument).mockResolvedValue({ id: 'd1', name: 'Report.docx', folder: 'Reports', tags: ['q3'], isStarred: true, updatedAt: '2026-09-20T00:00:00.000Z', sizeInBytes: 200, role: 'owner' });
    vi.mocked(bulkUpdateWorkspaceDocuments).mockResolvedValue({ updated: 1 });
  });

  it('loads AI settings, keeps the operator endpoint read-only, and saves account preferences', async () => {
    const user = userEvent.setup();
    renderProfile(<AiSettingsSection />);

    expect(await screen.findByRole('heading', { name: 'AI assistant' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Base URL' })).toHaveAttribute('readonly');
    await user.clear(screen.getByRole('textbox', { name: 'Model' }));
    await user.type(screen.getByRole('textbox', { name: 'Model' }), 'gpt-next');
    await user.click(screen.getByRole('checkbox', { name: /enable ai/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(vi.mocked(updateAiSettings).mock.calls[0]?.[0]).toEqual({
      model: 'gpt-next',
      baseUrl: 'https://api.example.com/v1',
      enabled: false,
    }));
  });

  it('lists unread notifications and marks all of them read', async () => {
    const user = userEvent.setup();
    renderProfile(<NotificationsSection />);

    expect(await screen.findByText('document.shared')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(markWorkspaceNotificationsRead).toHaveBeenCalledWith(undefined));
  });

  it('imports a Google Drive template URL and navigates to the saved document', async () => {
    const user = userEvent.setup();
    renderProfile(<><TemplatesSection /><LocationProbe /></>, { route: '/settings/templates' });

    expect(screen.getByRole('heading', { name: 'Templates gallery' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Document URL' }), 'https://drive.google.com/file/d/abc123/view');
    await user.click(screen.getByRole('button', { name: 'Import and open' }));

    await waitFor(() => expect(importDocumentUrl).toHaveBeenCalledWith('https://drive.google.com/uc?export=download&id=abc123'));
    expect(screen.getByTestId('location')).toHaveTextContent('/app?source=saved&documentId=d-imported');
  });

  it('searches workspace documents and updates both per-document metadata and bulk selection', async () => {
    const user = userEvent.setup();
    renderProfile(<WorkspaceToolsPanel />);

    await user.click(screen.getByRole('button', { name: 'Load organization tools' }));
    expect(await screen.findByText('Report.docx')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search document text' }), 'report');
    await user.click(screen.getAllByRole('checkbox')[0]!);
    await user.type(screen.getByRole('textbox', { name: 'Report.docx folder' }), 'Reports');
    await user.type(screen.getByRole('textbox', { name: 'Report.docx tags' }), 'q3, planning');
    await user.click(screen.getByRole('button', { name: 'Save metadata' }));
    await user.click(screen.getByRole('button', { name: 'Apply folder' }));

    await waitFor(() => expect(updateWorkspaceDocument).toHaveBeenCalledWith('d1', { folder: 'Reports', tags: ['q3', 'planning'] }));
    await waitFor(() => expect(bulkUpdateWorkspaceDocuments).toHaveBeenCalledWith(['d1'], { folder: null }));
    expect(listWorkspaceDocuments).toHaveBeenCalledWith('report');
  });
});
