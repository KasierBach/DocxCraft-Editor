import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import type { SavedDocumentSummary } from '../lib/documentApi';
import type { RecoverySnapshot } from '../lib/recoveryStore';
import { downloadBufferAsDocx } from '../lib/download';
import { useAppStore } from '../store/appStore';
import { mockState } from '../test/editorMock';

vi.mock('@eigenpal/docx-editor-react', async () => {
  const mock = await import('../test/editorMock');
  return {
    DocxEditor: mock.DocxEditor,
    createEmptyDocument: mock.createEmptyDocument,
  };
});

vi.mock('../lib/download', () => ({
  triggerBlobDownload: vi.fn(),
  downloadBufferAsDocx: vi.fn(),
}));

const mockedDownload = vi.mocked(downloadBufferAsDocx);

const {
  docxEditorRenderLog,
  editorSave,
  triggerEditorContentChange,
  triggerEditorSelectionChange,
} = mockState;

const openSavedDocument = vi.fn();
const saveCurrentDocument = vi.fn();
const renameSavedDocument = vi.fn();
const deleteSavedDocument = vi.fn();
const duplicateSavedDocument = vi.fn();
const restoreDocumentVersion = vi.fn();
const readSavedDocumentBuffer = vi.fn();
const readVersionBuffer = vi.fn();
const refreshDocuments = vi.fn();
const refreshVersions = vi.fn();
const discardRecovery = vi.fn();
let mockedRecoverySnapshot: RecoverySnapshot | null = null;
let mockedSavedDocuments: SavedDocumentSummary[] = [];

function makeSavedDocument(id: string, name: string): SavedDocumentSummary {
  return { id, name } as unknown as SavedDocumentSummary;
}

vi.mock('../demoDocument', () => ({
  createDemoDocument: () => ({ type: 'demo-document' }),
}));

vi.mock('../lib/anchors', () => ({
  collectAnchorTargets: () => [
    {
      id: 'para-1',
      label: 'Paragraph 1',
      pageNumber: 1,
      paragraphIndex: 0,
      styleId: 'Normal',
    },
    {
      id: 'para-2',
      label: 'Paragraph 2',
      pageNumber: 1,
      paragraphIndex: 1,
      styleId: 'Normal',
    },
  ],
}));

vi.mock('../hooks/useAnchors', async () => {
  const React = await import('react');

  return {
    useAnchors: () => {
      const [activeParaId, setActiveParaId] = React.useState<string | null>('para-1');

      return {
        anchors: [
          {
            id: 'para-1',
            label: 'Paragraph 1',
            pageNumber: 1,
            paragraphIndex: 0,
            styleId: 'Normal',
          },
          {
            id: 'para-2',
            label: 'Paragraph 2',
            pageNumber: 1,
            paragraphIndex: 1,
            styleId: 'Normal',
          },
        ],
        setAnchors: vi.fn(),
        filteredAnchors: [
          {
            id: 'para-1',
            label: 'Paragraph 1',
            pageNumber: 1,
            paragraphIndex: 0,
            styleId: 'Normal',
          },
          {
            id: 'para-2',
            label: 'Paragraph 2',
            pageNumber: 1,
            paragraphIndex: 1,
            styleId: 'Normal',
          },
        ],
        activeParaId,
        setActiveParaId,
        searchQuery: '',
        setSearchQuery: vi.fn(),
        filterStyle: 'all',
        setFilterStyle: vi.fn(),
        uniqueStyles: ['Normal'],
        resetFilters: vi.fn(),
      };
    },
  };
});

vi.mock('../hooks/useDocumentLibrary', async () => {
  const React = await import('react');

  return {
    useDocumentLibrary: ({ initialDocumentName }: { initialDocumentName: string }) => {
      const [documentName, setDocumentName] = React.useState(initialDocumentName);
      const [currentDocumentId, setCurrentDocumentId] = React.useState<string | null>(null);

      return {
        currentDocumentId,
        currentDocumentVersions: [],
        documentName,
        isLoadingDocuments: false,
        isLoadingVersions: false,
        isSaving: false,
        libraryError: null,
        versionError: null,
        savedDocuments: mockedSavedDocuments,
        setCurrentDraft: ({ name, documentId }: { name: string; documentId: string | null }) => {
          setDocumentName(name);
          setCurrentDocumentId(documentId);
        },
        setDocumentName,
        refreshDocuments,
        refreshVersions,
        saveCurrentDocument,
        openSavedDocument: async (documentId: string) => {
          const openedDocument = await openSavedDocument(documentId);
          setCurrentDocumentId(documentId);
          setDocumentName(openedDocument.name);
          return openedDocument;
        },
        renameSavedDocument,
        deleteSavedDocument,
        duplicateSavedDocument,
        restoreDocumentVersion,
        readSavedDocumentBuffer,
        readVersionBuffer,
      };
    },
  };
});

vi.mock('../hooks/useApiStatus', () => ({
  useApiStatus: () => ({
    status: 'connected',
  }),
}));

vi.mock('../hooks/useRecoveryDraft', () => ({
  useRecoveryDraft: () => ({
    recoverySnapshot: mockedRecoverySnapshot,
    isSavingRecovery: false,
    saveRecovery: vi.fn(),
    discardRecovery,
    refreshRecovery: vi.fn(),
  }),
}));

vi.mock('../components/layout/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

// The real RightSidebar renders a full document library UI; here it is
// replaced with a probe that exposes every handler prop App passes in, so
// the handler callbacks themselves can be exercised directly.
vi.mock('../components/layout/RightSidebar', () => ({
  RightSidebar: (props: Record<string, ((...args: unknown[]) => unknown) | undefined>) => (
    <aside data-testid="right-sidebar">
      <button type="button" onClick={() => props.onRefreshDocuments?.()}>
        probe-refresh-documents
      </button>
      <button type="button" onClick={() => props.onRenameDocument?.('doc-1', 'Renamed.docx')}>
        probe-rename-document
      </button>
      <button type="button" onClick={() => props.onDeleteDocument?.('doc-1')}>
        probe-delete-document
      </button>
      <button type="button" onClick={() => props.onDuplicateDocument?.('doc-1')}>
        probe-duplicate-document
      </button>
      <button type="button" onClick={() => props.onDownloadDocument?.('doc-1')}>
        probe-download-document
      </button>
      <button type="button" onClick={() => props.onRestoreRecovery?.()}>
        probe-restore-recovery
      </button>
      <button type="button" onClick={() => props.onDiscardRecovery?.()}>
        probe-discard-recovery
      </button>
    </aside>
  ),
}));

describe('App handler and deep-link flows', () => {
  beforeEach(() => {
    // Dismiss the first-run onboarding so it does not render a competing
    // role="dialog" alongside the command palette / shortcut help modals.
    window.localStorage.setItem('docxcraft:onboarded', 'done');
    window.history.replaceState(null, '', '/');
    docxEditorRenderLog.length = 0;
    editorSave.mockReset();
    triggerEditorContentChange.mockReset();
    triggerEditorSelectionChange.mockReset();
    openSavedDocument.mockReset();
    saveCurrentDocument.mockReset();
    renameSavedDocument.mockReset();
    deleteSavedDocument.mockReset();
    duplicateSavedDocument.mockReset();
    restoreDocumentVersion.mockReset();
    readSavedDocumentBuffer.mockReset();
    readVersionBuffer.mockReset();
    refreshDocuments.mockReset();
    refreshVersions.mockReset();
    discardRecovery.mockReset();
    mockedDownload.mockReset();
    mockedRecoverySnapshot = null;
    mockedSavedDocuments = [];
    mockState.nextSelectionInfo = null;
  });

  it('opens a saved document from a deep link on mount', async () => {
    const buffer = new ArrayBuffer(8);
    openSavedDocument.mockResolvedValue({
      id: 'doc-42',
      name: 'Deep Linked.docx',
      buffer,
    });

    window.history.replaceState(null, '', '/?source=saved&documentId=doc-42&paraId=para-2');
    render(<App />);

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/opened deep linked\.docx from a deep link\./i);
    });
    expect(openSavedDocument).toHaveBeenCalledWith('doc-42');

    const renderedBuffers = docxEditorRenderLog
      .map((entry) => entry.documentBuffer)
      .filter((entry): entry is ArrayBuffer => entry instanceof ArrayBuffer);
    expect(renderedBuffers).toContain(buffer);
  });

  it('surfaces an error toast when the deep link document cannot be opened', async () => {
    openSavedDocument.mockRejectedValue(new Error('Document not found'));

    window.history.replaceState(null, '', '/?source=saved&documentId=doc-missing');
    render(<App />);

    expect(await screen.findByText(/deep link open failed\./i)).toBeInTheDocument();
    expect(await screen.findByText(/document not found/i)).toBeInTheDocument();
    expect(docxEditorRenderLog.every((entry) => entry.documentBuffer === undefined)).toBe(true);
  });

  it('reopens the remembered document when the URL carries no deep link', async () => {
    const buffer = new ArrayBuffer(8);
    openSavedDocument.mockResolvedValue({
      id: 'doc-77',
      name: 'Remembered.docx',
      buffer,
    });
    // What a refresh looks like: the store still holds the open document while
    // the URL has no deep link left (the URL is rewritten to source=sample).
    useAppStore.getState().setOpenDocument({
      kind: 'saved-document',
      documentId: 'doc-77',
      name: 'Remembered.docx',
    });
    window.history.replaceState(null, '', '/app');

    render(<App />);

    await waitFor(() => {
      expect(openSavedDocument).toHaveBeenCalledWith('doc-77');
    });

    const renderedBuffers = docxEditorRenderLog
      .map((entry) => entry.documentBuffer)
      .filter((entry): entry is ArrayBuffer => entry instanceof ArrayBuffer);
    expect(renderedBuffers).toContain(buffer);
  });

  it('forgets a remembered document that can no longer be opened', async () => {
    openSavedDocument.mockRejectedValue(new Error('Document not found'));
    useAppStore.getState().setOpenDocument({
      kind: 'saved-document',
      documentId: 'doc-gone',
      name: 'Gone.docx',
    });
    window.history.replaceState(null, '', '/app');

    render(<App />);

    expect(await screen.findByText(/deep link open failed\./i)).toBeInTheDocument();
    await waitFor(() => {
      expect(useAppStore.getState().openDocument).toBeNull();
    });
  });

  it('restores a local-file recovery snapshot from the right sidebar', async () => {
    const buffer = new ArrayBuffer(8);
    mockedRecoverySnapshot = {
      sourceKind: 'local-file',
      documentId: null,
      documentName: 'Crashed Draft.docx',
      activeParaId: 'para-2',
      savedAt: new Date().toISOString(),
      buffer,
    };
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-restore-recovery' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/restored unsaved work for crashed draft\.docx\./i);
    });
    expect(discardRecovery).toHaveBeenCalledTimes(1);

    const renderedBuffers = docxEditorRenderLog
      .map((entry) => entry.documentBuffer)
      .filter((entry): entry is ArrayBuffer => entry instanceof ArrayBuffer);
    expect(renderedBuffers).toContain(buffer);
  });

  it('restores a saved-document recovery snapshot and refreshes its versions', async () => {
    const buffer = new ArrayBuffer(8);
    mockedRecoverySnapshot = {
      sourceKind: 'saved-document',
      documentId: 'doc-7',
      documentName: 'Recovered.docx',
      activeParaId: null,
      savedAt: new Date().toISOString(),
      buffer,
    };
    refreshVersions.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-restore-recovery' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/restored unsaved work for recovered\.docx\./i);
    });
    expect(refreshVersions).toHaveBeenCalledWith('doc-7');
    expect(discardRecovery).toHaveBeenCalledTimes(1);
  });

  it('discards the recovery snapshot from the right sidebar', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-discard-recovery' }));

    expect(discardRecovery).toHaveBeenCalledTimes(1);
  });

  it('refreshes the saved document library', async () => {
    refreshDocuments.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-refresh-documents' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/saved documents refreshed\./i);
    });
    expect(refreshDocuments).toHaveBeenCalledTimes(1);
  });

  it('renames a saved document', async () => {
    mockedSavedDocuments = [makeSavedDocument('doc-1', 'Old Name.docx')];
    renameSavedDocument.mockResolvedValue({ id: 'doc-1', name: 'Renamed.docx' });
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-rename-document' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/renamed saved document to renamed\.docx\./i);
    });
    expect(renameSavedDocument).toHaveBeenCalledWith('doc-1', 'Renamed.docx');
  });

  it('deletes a saved document that is not currently open', async () => {
    mockedSavedDocuments = [makeSavedDocument('doc-1', 'Doomed.docx')];
    deleteSavedDocument.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-delete-document' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/deleted doomed\.docx from the local library\./i);
    });
    expect(deleteSavedDocument).toHaveBeenCalledWith('doc-1');
  });

  it('duplicates a saved document', async () => {
    mockedSavedDocuments = [makeSavedDocument('doc-1', 'Original.docx')];
    duplicateSavedDocument.mockResolvedValue({ id: 'doc-2', name: 'Original copy.docx' });
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-duplicate-document' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/duplicated original copy\.docx\./i);
    });
    expect(duplicateSavedDocument).toHaveBeenCalledWith('doc-1');
  });

  it('downloads a saved document buffer as a docx file', async () => {
    mockedSavedDocuments = [makeSavedDocument('doc-1', 'Exported.docx')];
    const buffer = new ArrayBuffer(8);
    readSavedDocumentBuffer.mockResolvedValue(buffer);
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'probe-download-document' }));

    const toast = await screen.findByRole('status');
    await waitFor(() => {
      expect(toast).toHaveTextContent(/downloaded exported\.docx\./i);
    });
    expect(readSavedDocumentBuffer).toHaveBeenCalledWith('doc-1');
    expect(mockedDownload).toHaveBeenCalledWith('Exported.docx', buffer);
  });

  it('opens and closes the command palette with its keyboard shortcut', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('{Control>}p{/Control}');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens and closes the shortcut help modal with its keyboard shortcut', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.keyboard('{Control>}/{/Control}');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens the shortcut help from the command palette action', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.keyboard('{Control>}p{/Control}');
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('option', { name: /show keyboard shortcuts/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});




