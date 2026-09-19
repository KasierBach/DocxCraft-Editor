import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import type { RecoverySnapshot } from '../lib/recoveryStore';
import { mockState } from '../test/editorMock';

vi.mock('@eigenpal/docx-editor-react', async () => {
  const mock = await import('../test/editorMock');
  return {
    DocxEditor: mock.DocxEditor,
    createEmptyDocument: mock.createEmptyDocument,
  };
});

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

async function openUtilityMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /more actions/i }));
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
        savedDocuments: [],
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

vi.mock('../components/layout/RightSidebar', () => ({
  RightSidebar: ({ activeParaId }: { activeParaId: string | null }) => (
    <aside data-testid="right-sidebar">
      <span data-testid="active-para">{activeParaId ?? 'none'}</span>
    </aside>
  ),
}));

describe('App', () => {
  beforeEach(() => {
    docxEditorRenderLog.length = 0;
    editorSave.mockReset();
    triggerEditorContentChange.mockReset();
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
    triggerEditorSelectionChange.mockReset();
    mockedRecoverySnapshot = null;
    mockState.nextSelectionInfo = null;
  });

  it('reloads the current local docx source', async () => {
    const user = userEvent.setup();

    render(<App />);

    await openUtilityMenu(user);
    expect(screen.getByRole('menuitem', { name: /reload current document/i })).toBeDisabled();

    const localBuffer = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 9, 8, 7, 6]);
    const file = new File([localBuffer], 'External Draft.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await user.upload(screen.getByLabelText(/open \.docx from computer/i), file);
    await openUtilityMenu(user);
    expect(screen.getByRole('menuitem', { name: /reload current document/i })).toBeEnabled();
    await user.click(screen.getByRole('menuitem', { name: /reload current document/i }));

    const reloadToast = await screen.findByRole('status');
    expect(reloadToast).toHaveTextContent(/reloaded external draft\.docx\./i);

    const renderedBuffers = docxEditorRenderLog
      .map((entry) => entry.documentBuffer)
      .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);

    expect(renderedBuffers.length).toBeGreaterThanOrEqual(2);
    expect(Array.from(new Uint8Array(renderedBuffers.at(-2)!))).toEqual(Array.from(localBuffer));
    expect(Array.from(new Uint8Array(renderedBuffers.at(-1)!))).toEqual(Array.from(localBuffer));
  });

  it('marks the editor dirty after a content change and clears it after save with a toast', async () => {
    const user = userEvent.setup();
    editorSave.mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer);
    saveCurrentDocument.mockResolvedValue({
      id: 'doc-1',
      name: 'Built-in sample.docx',
      createdAt: '2026-05-25T05:20:00.000Z',
      updatedAt: '2026-05-25T05:22:00.000Z',
      sizeInBytes: 4,
      lastOpenedAt: null,
      versionCount: 1,
      deletedAt: null,
    });

    render(<App />);

    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /simulate content change/i }));

    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(saveCurrentDocument).toHaveBeenCalled();
    });

    expect(screen.queryByText(/^unsaved changes$/i)).not.toBeInTheDocument();

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/document "built-in sample\.docx" saved to library/i);
  });

  it('replaces the current toast instead of stacking multiple notifications', async () => {
    const user = userEvent.setup();

    render(<App />);

    await openUtilityMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /load sample/i }));
    const firstToast = await screen.findByRole('status');
    expect(firstToast).toHaveTextContent(/sample reloaded\./i);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    await openUtilityMenu(user);
    expect(screen.getByRole('menuitem', { name: /reload current document/i })).toBeDisabled();
  });

  it('keeps the active anchor in sync when selection info has no paraId', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByTestId('active-para')).toHaveTextContent('para-1');

    mockState.nextSelectionInfo = {
      paraId: null,
      selectedText: '',
      paragraphText: 'Paragraph 2',
      before: '',
      after: '',
    };

    await user.click(screen.getByRole('button', { name: /simulate selection change/i }));

    await waitFor(() => {
      expect(screen.getByTestId('active-para')).toHaveTextContent('para-2');
    });
  });

  it('does not replace the requested document with recovery data on startup', () => {
    mockedRecoverySnapshot = {
      sourceKind: 'sample',
      documentId: null,
      documentName: 'Recovered sample.docx',
      activeParaId: 'para-2',
      savedAt: '2026-06-04T10:00:00.000Z',
      buffer: Uint8Array.from([7, 6, 5, 4]).buffer,
    };

    render(<App />);

    expect(discardRecovery).not.toHaveBeenCalled();
    expect(screen.getByTestId('active-para')).toHaveTextContent('para-1');
    expect(screen.queryByText(/recovered unsaved work/i)).not.toBeInTheDocument();
    expect(
      docxEditorRenderLog.some((entry) =>
        entry.documentBuffer
          ? Array.from(new Uint8Array(entry.documentBuffer)).join(',') === '7,6,5,4'
          : false,
      ),
    ).toBe(false);
  });
});
