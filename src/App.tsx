import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DocxEditor, type DocxEditorRef } from '@eigenpal/docx-editor-react';
import type { Document } from '@eigenpal/docx-editor-core';
import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror';
import '@eigenpal/docx-editor-react/styles.css';

import { Header } from './components/layout/Header';
import { RightSidebar } from './components/layout/RightSidebar';
import { Sidebar } from './components/layout/Sidebar';
import { EditorStatusBar } from './components/layout/EditorStatusBar';
import { CommandPalette } from './components/ui/CommandPalette';
import { ShortcutHelpModal } from './components/ui/ShortcutHelpModal';
import { ToastViewport } from './components/ToastViewport';
import { createDemoDocument } from './demoDocument';
import { useAnchors } from './hooks/useAnchors';
import { useApiStatus } from './hooks/useApiStatus';
import { useDocumentLibrary } from './hooks/useDocumentLibrary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRecoveryDraft } from './hooks/useRecoveryDraft';
import { useToastManager } from './hooks/useToastManager';
import { collectAnchorTargets, type PageContent } from './lib/anchors';
import { buildDeepLinkSearch, readDeepLink } from './lib/deepLink';
import { downloadBufferAsDocx } from './lib/download';
import { findFlashHighlightTarget } from './lib/highlightTarget';
import { resolveActiveAnchorId } from './lib/resolveActiveAnchor';
import './app.css';
import './styles/components/modals.css';
import './styles/components/command-palette.css';
import './styles/layout/status-bar.css';
import './styles/layout/breadcrumbs.css';

type EditorSource =
  | { kind: 'sample'; name: string; document: Document }
  | { kind: 'local-file'; name: string; buffer: ArrayBuffer }
  | { kind: 'saved-document'; name: string; documentId: string; buffer: ArrayBuffer };

const SAMPLE_DOCUMENT_NAME = 'Built-in sample.docx';

function createSampleSource(): EditorSource {
  return {
    kind: 'sample',
    name: SAMPLE_DOCUMENT_NAME,
    document: createDemoDocument(),
  };
}

function isSavedSource(source: EditorSource): source is Extract<EditorSource, { kind: 'saved-document' }> {
  return source.kind === 'saved-document';
}

export default function App() {
  const editorRef = useRef<DocxEditorRef>(null);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const ignoreContentChangeUntilRef = useRef(0);
  const lastSelectionStateRef = useRef<SelectionState | null>(null);
  const activeParaIdRef = useRef<string | null>(null);
  const lastLibraryErrorRef = useRef<string | null>(null);
  const lastVersionErrorRef = useRef<string | null>(null);

  const initialDeepLink = useMemo(() => readDeepLink(window.location.search), []);
  const [source, setSource] = useState<EditorSource>(() => createSampleSource());
  const [editorKey, setEditorKey] = useState(0);
  const [pendingDeepLinkParaId, setPendingDeepLinkParaId] = useState<string | null>(
    initialDeepLink.paraId,
  );
  const [currentPage, setCurrentPage] = useState<number | null>(1);
  const [statusMessage, setStatusMessage] = useState('Ready.');
  const [isDirty, setIsDirty] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hasHandledInitialDeepLink = useRef(false);

  // Use toast manager hook
  const { toasts, pushToast, dismissToast } = useToastManager();

  const {
    currentDocumentId,
    currentDocumentVersions,
    documentName,
    isLoadingDocuments,
    isLoadingVersions,
    isSaving,
    libraryError,
    savedDocuments,
    setCurrentDraft,
    setDocumentName,
    versionError,
    refreshDocuments,
    refreshVersions,
    saveCurrentDocument,
    openSavedDocument,
    renameSavedDocument,
    deleteSavedDocument,
    duplicateSavedDocument,
    restoreDocumentVersion,
    readSavedDocumentBuffer,
    readVersionBuffer,
  } = useDocumentLibrary({
    initialDocumentName: SAMPLE_DOCUMENT_NAME,
  });

  const { status: apiStatus } = useApiStatus();

  const {
    anchors,
    setAnchors,
    filteredAnchors,
    activeParaId,
    setActiveParaId,
    searchQuery,
    setSearchQuery,
    filterStyle,
    setFilterStyle,
    uniqueStyles,
    resetFilters,
  } = useAnchors();

  const [wordCount, setWordCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  // Update metrics when anchors or source changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const timerId = window.setTimeout(() => {
      setPageCount(editor.getTotalPages() || 1);
      
      const totalWords = filteredAnchors.reduce((acc, anchor) => {
        return acc + (anchor.label?.trim().split(/\s+/).length || 0);
      }, 0);
      setWordCount(totalWords);
    }, 500);

    return () => window.clearTimeout(timerId);
  }, [anchors, filteredAnchors, editorKey]);

  useEffect(() => {
    const handleGlobalScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('scroll', handleGlobalScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleGlobalScroll);
  }, []);

  const getEditorBuffer = useCallback(async () => {
    return (await editorRef.current?.save()) ?? null;
  }, []);

  const { recoverySnapshot, discardRecovery } = useRecoveryDraft({
    sourceKind: source.kind,
    documentId: currentDocumentId,
    documentName,
    activeParaId,
    isDirty,
    getBuffer: getEditorBuffer,
    autosaveDelayMs: 12000,
  });

  const currentTargetLabel = useMemo(
    () => anchors.find((anchor) => anchor.id === activeParaId)?.label ?? 'No paragraph selected',
    [activeParaId, anchors],
  );

  useEffect(() => {
    activeParaIdRef.current = activeParaId;
  }, [activeParaId]);

  useEffect(() => {
    if (libraryError && libraryError !== lastLibraryErrorRef.current) {
      setStatusMessage('Library issue.');
      pushToast('error', libraryError);
    }

    lastLibraryErrorRef.current = libraryError;
  }, [libraryError, pushToast]);

  useEffect(() => {
    if (versionError && versionError !== lastVersionErrorRef.current) {
      setStatusMessage('Version history issue.');
      pushToast('error', versionError);
    }

    lastVersionErrorRef.current = versionError;
  }, [pushToast, versionError]);

  const refreshAnchors = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return false;
    }

    const totalPages = editor.getTotalPages();
    if (!Number.isInteger(totalPages) || totalPages < 1) {
      return false;
    }

    const pages: PageContent[] = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = editor.getPageContent(pageNumber);
      if (page) {
        pages.push(page);
      }
    }

    const nextAnchors = collectAnchorTargets(pages);
    const nextActiveParaId = resolveActiveAnchorId({
      anchors: nextAnchors,
      selectionInfo: editor.getSelectionInfo(),
      selectionState: lastSelectionStateRef.current,
      fallbackActiveParaId: activeParaIdRef.current,
      preferFirstAnchor: true,
    });

    setAnchors(nextAnchors);
    setActiveParaId(nextActiveParaId);
    setCurrentPage(editor.getCurrentPage());

    if (nextAnchors.length > 0) {
      setStatusMessage(`Indexed ${nextAnchors.length} paragraphs across ${totalPages} pages.`);
    }

    return nextAnchors.length > 0;
  }, [setActiveParaId, setAnchors]);

  const scheduleAnchorRefresh = useCallback(
    (attempts = 10) => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        const refreshWorked = refreshAnchors();
        if (!refreshWorked && attempts > 1) {
          scheduleAnchorRefresh(attempts - 1);
        }
      }, attempts === 10 ? 180 : 250);
    },
    [refreshAnchors],
  );

  useEffect(() => {
    scheduleAnchorRefresh();
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [editorKey, scheduleAnchorRefresh, source]);

  const loadEditorSource = useCallback(
    (nextSource: EditorSource) => {
      ignoreContentChangeUntilRef.current = Date.now() + 800;
      setSource(nextSource);
      setEditorKey((value) => value + 1);
      setIsDirty(false);
      resetFilters();
    },
    [resetFilters],
  );

  const rememberSavedSource = useCallback((documentId: string, name: string, buffer: ArrayBuffer) => {
    setSource((currentSource) => {
      if (currentSource.kind === 'saved-document' && currentSource.documentId === documentId) {
        // Only update the buffer/name metadata without triggering a full re-load if possible
        if (currentSource.name === name && currentSource.buffer === buffer) {
          return currentSource;
        }
        return {
          ...currentSource,
          name,
          buffer,
        };
      }

      return {
        kind: 'saved-document',
        name,
        documentId,
        buffer,
      };
    });
  }, []);

  const loadBuiltInSample = useCallback(() => {
    loadEditorSource(createSampleSource());
    setCurrentDraft({ name: SAMPLE_DOCUMENT_NAME, documentId: null });
    setPendingDeepLinkParaId(initialDeepLink.source === 'sample' ? initialDeepLink.paraId : null);
    discardRecovery();
    setStatusMessage('Sample reloaded.');
    pushToast('info', 'Sample reloaded.');
  }, [discardRecovery, initialDeepLink.paraId, initialDeepLink.source, loadEditorSource, pushToast, setCurrentDraft]);

  useEffect(() => {
    let isCancelled = false;

    if (!hasHandledInitialDeepLink.current && initialDeepLink.source === 'saved' && initialDeepLink.documentId) {
      hasHandledInitialDeepLink.current = true;
      void (async () => {
        try {
          const openedDocument = await openSavedDocument(initialDeepLink.documentId!);
          if (isCancelled) {
            return;
          }

          loadEditorSource({
            kind: 'saved-document',
            name: openedDocument.name,
            documentId: openedDocument.id,
            buffer: openedDocument.buffer,
          });
          setPendingDeepLinkParaId(initialDeepLink.paraId);
          setStatusMessage(`Opened ${openedDocument.name} from a deep link.`);
          pushToast('info', `Opened ${openedDocument.name} from a deep link.`);
          setLastSavedAt(new Date().toISOString());
        } catch (error) {
          if (isCancelled) {
            return;
          }

          const message = error instanceof Error ? error.message : 'Deep link open failed.';
          setStatusMessage('Deep link open failed.');
          pushToast('error', message);
        }
      })();
    }

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeepLink.documentId, initialDeepLink.paraId, initialDeepLink.source]);

  useEffect(() => {
    if (!pendingDeepLinkParaId) {
      return;
    }

    if (!anchors.some((anchor) => anchor.id === pendingDeepLinkParaId)) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const editor = editorRef.current;
      const anchor = anchors.find((item) => item.id === pendingDeepLinkParaId);
      if (!editor || !anchor) {
        return;
      }

      editor.scrollToPage(anchor.pageNumber);
      editor.scrollToParaId(pendingDeepLinkParaId);
      setActiveParaId(pendingDeepLinkParaId);
      setCurrentPage(anchor.pageNumber);
      setPendingDeepLinkParaId(null);
    }, 120);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [anchors, pendingDeepLinkParaId, setActiveParaId]);

  useEffect(() => {
    const nextSearch = buildDeepLinkSearch({
      source:
        source.kind === 'saved-document' && currentDocumentId
          ? 'saved'
          : source.kind === 'sample'
            ? 'sample'
            : null,
      documentId: source.kind === 'saved-document' ? currentDocumentId : null,
      paraId: activeParaId,
    });

    if (nextSearch !== window.location.search) {
      const nextUrl = `${window.location.pathname}${nextSearch}`;
      window.history.replaceState(null, '', nextUrl);
    }
  }, [activeParaId, currentDocumentId, source.kind]);

  const handleDocumentNameChange = useCallback(
    (name: string) => {
      if (name !== documentName) {
        setIsDirty(true);
        setStatusMessage('Unsaved changes.');
      }

      setDocumentName(name);
    },
    [documentName, setDocumentName],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        loadEditorSource({
          kind: 'local-file',
          name: file.name,
          buffer,
        });
        setCurrentDraft({ name: file.name, documentId: null });
        setStatusMessage(`Loaded ${file.name}.`);
        pushToast('info', `Loaded ${file.name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'File read error.';
        setStatusMessage('File load failed.');
        pushToast('error', message);
      } finally {
        event.target.value = '';
      }
    },
    [loadEditorSource, pushToast, setCurrentDraft],
  );

  const handleSaveDocument = useCallback(async () => {
    try {
      const buffer = await getEditorBuffer();
      if (!buffer) {
        throw new Error('The editor did not return a document buffer.');
      }

      const savedDocument = await saveCurrentDocument(buffer);
      
      const isInitialSave = source.kind !== 'saved-document';
      
      // If we just converted a sample/local to a saved-doc, we NEED to update source
      // to keep track of the ID. But if it's ALREADY a saved-doc, we just update local state.
      if (isInitialSave) {
        rememberSavedSource(savedDocument.id, savedDocument.name, buffer);
      }

      discardRecovery();
      setIsDirty(false);
      
      const msg = !isInitialSave ? `Changes saved to "${savedDocument.name}"` : `Document "${savedDocument.name}" saved to library`;
      
      setStatusMessage(msg);
      pushToast('success', msg);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      setStatusMessage('Save failed.');
      pushToast('error', message);
    }
  }, [discardRecovery, getEditorBuffer, pushToast, rememberSavedSource, saveCurrentDocument, source.kind]);

  const handleSaveAsDocument = useCallback(async () => {
    try {
      const buffer = await getEditorBuffer();
      if (!buffer) {
        throw new Error('The editor did not return a document buffer.');
      }

      const savedDocument = await saveCurrentDocument(buffer, {
        asNew: true,
        name: documentName,
      });
      loadEditorSource({
        kind: 'saved-document',
        name: savedDocument.name,
        documentId: savedDocument.id,
        buffer,
      });
      discardRecovery();
      setStatusMessage(`Saved ${savedDocument.name} as a new document.`);
      pushToast('success', `Saved ${savedDocument.name} as a new document.`);
      setLastSavedAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save as failed.';
      setStatusMessage('Save as failed.');
      pushToast('error', message);
    }
  }, [discardRecovery, documentName, getEditorBuffer, loadEditorSource, pushToast, saveCurrentDocument]);

  const handleDownloadCurrent = useCallback(async () => {
    try {
      const buffer = await getEditorBuffer();
      if (!buffer) {
        throw new Error('The editor did not return a document buffer.');
      }

      downloadBufferAsDocx(documentName, buffer);
      setStatusMessage(`Downloaded ${documentName}.`);
      pushToast('success', `Downloaded ${documentName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed.';
      setStatusMessage('Download failed.');
      pushToast('error', message);
    }
  }, [documentName, getEditorBuffer, pushToast]);

  const handleOpenSavedDocument = useCallback(
    async (documentId: string) => {
      try {
        const openedDocument = await openSavedDocument(documentId);
        loadEditorSource({
          kind: 'saved-document',
          name: openedDocument.name,
          documentId: openedDocument.id,
          buffer: openedDocument.buffer,
        });
        setStatusMessage(`Opened ${openedDocument.name} from the local library.`);
        pushToast('success', `Opened ${openedDocument.name} from the local library.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Open failed.';
        setStatusMessage('Open failed.');
        pushToast('error', message);
      }
    },
    [loadEditorSource, openSavedDocument, pushToast],
  );

  const handleReloadDocument = useCallback(async () => {
    try {
      if (source.kind === 'sample') {
        loadBuiltInSample();
        return;
      }

      if (source.kind === 'saved-document' && currentDocumentId === source.documentId) {
        const reopenedDocument = await openSavedDocument(source.documentId);
        loadEditorSource({
          kind: 'saved-document',
          name: reopenedDocument.name,
          documentId: reopenedDocument.id,
          buffer: reopenedDocument.buffer,
        });
        discardRecovery();
        setStatusMessage(`Reloaded ${reopenedDocument.name} from the local library.`);
        pushToast('info', `Reloaded ${reopenedDocument.name} from the local library.`);
        return;
      }

      loadEditorSource({
        ...source,
        buffer: source.buffer.slice(0),
      });
      discardRecovery();
      setStatusMessage(`Reloaded ${source.name}.`);
      pushToast('info', `Reloaded ${source.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reload failed.';
      setStatusMessage('Reload failed.');
      pushToast('error', message);
    }
  }, [currentDocumentId, discardRecovery, loadBuiltInSample, loadEditorSource, openSavedDocument, pushToast, source]);

  const handleRefreshDocuments = useCallback(async () => {
    try {
      await refreshDocuments();
      setStatusMessage('Saved documents refreshed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refresh failed.';
      setStatusMessage('Refresh failed.');
      pushToast('error', message);
    }
  }, [pushToast, refreshDocuments]);

  const handleRenameSavedDocument = useCallback(
    async (documentId: string, name: string) => {
      try {
        const renamedDocument = await renameSavedDocument(documentId, name);
        if (isSavedSource(source) && source.documentId === documentId) {
          rememberSavedSource(documentId, renamedDocument.name, source.buffer);
        }
        setStatusMessage(`Renamed saved document to ${renamedDocument.name}.`);
        pushToast('success', `Renamed saved document to ${renamedDocument.name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rename failed.';
        setStatusMessage('Rename failed.');
        pushToast('error', message);
      }
    },
    [pushToast, rememberSavedSource, renameSavedDocument, source],
  );

  const handleDeleteSavedDocument = useCallback(
    async (documentId: string) => {
      const deletedDocument = savedDocuments.find((document) => document.id === documentId) ?? null;

      try {
        await deleteSavedDocument(documentId);
        if (isSavedSource(source) && source.documentId === documentId) {
          loadBuiltInSample();
        }
        setStatusMessage(
          deletedDocument
            ? `Deleted ${deletedDocument.name} from the local library.`
            : 'Deleted saved document from the local library.',
        );
        pushToast(
          'success',
          deletedDocument
            ? `Deleted ${deletedDocument.name} from the local library.`
            : 'Deleted saved document from the local library.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Delete failed.';
        setStatusMessage('Delete failed.');
        pushToast('error', message);
      }
    },
    [deleteSavedDocument, loadBuiltInSample, pushToast, savedDocuments, source],
  );

  const handleDuplicateSavedDocument = useCallback(
    async (documentId: string) => {
      try {
        const duplicatedDocument = await duplicateSavedDocument(documentId);
        setStatusMessage(`Duplicated ${duplicatedDocument.name}.`);
        pushToast('success', `Duplicated ${duplicatedDocument.name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Duplicate failed.';
        setStatusMessage('Duplicate failed.');
        pushToast('error', message);
      }
    },
    [duplicateSavedDocument, pushToast],
  );

  const handleDownloadSavedDocument = useCallback(
    async (documentId: string) => {
      try {
        const buffer = await readSavedDocumentBuffer(documentId);
        const savedDocument =
          savedDocuments.find((document) => document.id === documentId) ?? null;
        const name = savedDocument?.name ?? documentName;

        downloadBufferAsDocx(name, buffer);
        setStatusMessage(`Downloaded ${name}.`);
        pushToast('success', `Downloaded ${name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed.';
        setStatusMessage('Download failed.');
        pushToast('error', message);
      }
    },
    [documentName, pushToast, readSavedDocumentBuffer, savedDocuments],
  );

  const handleRestoreVersion = useCallback(
    async (documentId: string, versionId: string) => {
      try {
        const restored = await restoreDocumentVersion(documentId, versionId);
        loadEditorSource({
          kind: 'saved-document',
          name: restored.document.name,
          documentId,
          buffer: restored.buffer,
        });
        discardRecovery();
        setStatusMessage(`Restored a saved version of ${restored.document.name}.`);
        pushToast('success', `Restored a saved version of ${restored.document.name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Restore failed.';
        setStatusMessage('Restore failed.');
        pushToast('error', message);
      }
    },
    [discardRecovery, loadEditorSource, pushToast, restoreDocumentVersion],
  );

  const handleDownloadVersion = useCallback(
    async (documentId: string, versionId: string) => {
      try {
        const buffer = await readVersionBuffer(documentId, versionId);
        const version =
          currentDocumentVersions.find((entry) => entry.id === versionId) ?? null;
        const name = version?.name ?? documentName;
        downloadBufferAsDocx(name, buffer);
        setStatusMessage(`Downloaded ${name}.`);
        pushToast('success', `Downloaded ${name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Version download failed.';
        setStatusMessage('Version download failed.');
        pushToast('error', message);
      }
    },
    [currentDocumentVersions, documentName, pushToast, readVersionBuffer],
  );

  const handleRestoreRecovery = useCallback(() => {
    if (!recoverySnapshot) {
      return;
    }

    if (recoverySnapshot.sourceKind === 'saved-document' && recoverySnapshot.documentId) {
      loadEditorSource({
        kind: 'saved-document',
        name: recoverySnapshot.documentName,
        documentId: recoverySnapshot.documentId,
        buffer: recoverySnapshot.buffer,
      });
      setCurrentDraft({
        name: recoverySnapshot.documentName,
        documentId: recoverySnapshot.documentId,
      });
      void refreshVersions(recoverySnapshot.documentId).catch(() => undefined);
    } else {
      loadEditorSource({
        kind: 'local-file',
        name: recoverySnapshot.documentName,
        buffer: recoverySnapshot.buffer,
      });
      setCurrentDraft({
        name: recoverySnapshot.documentName,
        documentId: null,
      });
    }

    setPendingDeepLinkParaId(recoverySnapshot.activeParaId);
    setIsDirty(true);
    discardRecovery();
    setStatusMessage(`Restored unsaved work for ${recoverySnapshot.documentName}.`);
    pushToast('info', `Restored unsaved work for ${recoverySnapshot.documentName}.`);
  }, [discardRecovery, loadEditorSource, pushToast, recoverySnapshot, refreshVersions, setCurrentDraft]);

  const jumpToAnchor = useCallback(
    (paraId: string) => {
      const editor = editorRef.current;
      const anchor = anchors.find((item) => item.id === paraId);
      if (anchor) {
        editor?.scrollToPage(anchor.pageNumber);
      }

      const didScroll = editor?.scrollToParaId(paraId) ?? false;
      if (!didScroll) {
        return;
      }

      setActiveParaId(paraId);
      setCurrentPage(anchor?.pageNumber ?? editor?.getCurrentPage() ?? null);

      const startTime = Date.now();
      const maxSearchTime = 2000;

      const attemptHighlight = () => {
        const root = editorHostRef.current;
        if (!root) {
          return;
        }
        const targetElement = findFlashHighlightTarget(root, window.getSelection());
        if (targetElement) {
          targetElement.classList.remove('flash-highlight');
          void targetElement.offsetWidth;
          targetElement.classList.add('flash-highlight');

          if (root.parentElement) {
            root.parentElement.scrollLeft = 0;
          }
          root.scrollLeft = 0;

          window.scrollTo(0, 0);

          window.setTimeout(() => {
            targetElement.classList.remove('flash-highlight');
          }, 1500);
          return;
        }

        if (Date.now() - startTime < maxSearchTime) {
          window.setTimeout(attemptHighlight, 100);
        }
      };

      attemptHighlight();
    },
    [anchors, setActiveParaId],
  );

  const commandActions = useMemo(() => [
    { id: 'save', label: 'Save Document', section: 'Actions', handler: handleSaveDocument },
    { id: 'save-as', label: 'Save As Copy', section: 'Actions', handler: handleSaveAsDocument },
    { id: 'export', label: 'Export to .docx', section: 'Actions', handler: handleDownloadCurrent },
    { id: 'sample', label: 'Load Sample Document', section: 'Actions', handler: loadBuiltInSample },
    { id: 'toggle-sidebar', label: 'Toggle Left Sidebar', section: 'Actions', handler: () => setShowSidebar(s => !s) },
    { id: 'toggle-info', label: 'Toggle Right Sidebar', section: 'Actions', handler: () => setShowInfo(s => !s) },
    { id: 'help', label: 'Show Keyboard Shortcuts', section: 'Actions', handler: () => setShowShortcutHelp(true) },
  ], [handleSaveDocument, handleSaveAsDocument, handleDownloadCurrent, loadBuiltInSample]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 's',
        ctrlKey: true,
        handler: handleSaveDocument,
        description: 'Save document',
      },
      {
        key: 'o',
        ctrlKey: true,
        handler: () => {
          const fileInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".docx"]');
          fileInput?.click();
        },
        description: 'Open document',
      },
      {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
        handler: handleSaveAsDocument,
        description: 'Save as new document',
      },
      {
        key: '/',
        ctrlKey: true,
        handler: () => setShowShortcutHelp((show) => !show),
        description: 'Show shortcuts',
      },
      {
        key: '\\',
        ctrlKey: true,
        handler: () => setShowSidebar((show) => !show),
        description: 'Toggle sidebar',
      },
      {
        key: 'i',
        ctrlKey: true,
        handler: () => setShowInfo((show) => !show),
        description: 'Toggle info',
      },
      {
        key: 'p',
        ctrlKey: true,
        handler: () => setShowCommandPalette((show) => !show),
        description: 'Command palette',
      },
    ],
    enabled: true,
  });

  return (
    <div className="app-shell">
      <Header
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        showInfo={showInfo}
        onToggleInfo={() => setShowInfo(!showInfo)}
        documentName={documentName}
        onDocumentNameChange={handleDocumentNameChange}
        isDirty={isDirty}
        apiStatus={apiStatus}
        onLoadSample={loadBuiltInSample}
        onReload={handleReloadDocument}
        canReload={source.kind !== 'sample'}
        onFileChange={handleFileChange}
        onSave={handleSaveDocument}
        onSaveAs={handleSaveAsDocument}
        onDownloadCurrent={handleDownloadCurrent}
        isSaving={isSaving}
        onRefresh={() => scheduleAnchorRefresh()}
        sourceKind={source.kind}
      />

      <main
        className={`workspace ${!showSidebar ? 'sidebar--hidden' : ''} ${
          !showInfo ? 'info--hidden' : ''
        }`}
      >
        {showSidebar && (
          <Sidebar
            anchors={anchors}
            filteredAnchors={filteredAnchors}
            activeParaId={activeParaId}
            onJump={jumpToAnchor}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterStyle={filterStyle}
            onStyleChange={setFilterStyle}
            uniqueStyles={uniqueStyles}
            onResetFilters={resetFilters}
          />
        )}

        <section className="editor-panel">
          <div className="status-bar">
            <span className="status-bar__message">{statusMessage}</span>
          </div>
          <div ref={editorHostRef} className="editor-host">
            <DocxEditor
              key={editorKey}
              ref={editorRef}
              document={source.kind === 'sample' ? source.document : undefined}
              documentBuffer={source.kind !== 'sample' ? source.buffer : undefined}
              mode="editing"
              className="docx-editor-frame"
              onChange={() => {
                if (Date.now() < ignoreContentChangeUntilRef.current) {
                  return;
                }

                setIsDirty(true);
                setStatusMessage('Unsaved changes.');
              }}
              onSelectionChange={(selectionState) => {
                lastSelectionStateRef.current = selectionState;
                setActiveParaId(
                  resolveActiveAnchorId({
                    anchors,
                    selectionInfo: editorRef.current?.getSelectionInfo() ?? null,
                    selectionState,
                    fallbackActiveParaId: activeParaIdRef.current,
                  }),
                );
                setCurrentPage(editorRef.current?.getCurrentPage() ?? null);
                scheduleAnchorRefresh();
              }}
            />
          </div>

          <EditorStatusBar 
            wordCount={wordCount}
            pageCount={pageCount}
            currentPage={currentPage}
            lastSavedAt={lastSavedAt}
            isDirty={isDirty}
            onShowShortcuts={() => setShowShortcutHelp(true)}
          />
        </section>

        {showInfo && (
          <RightSidebar
            activeParaId={activeParaId}
            documentName={documentName}
            currentPage={currentPage}
            currentTargetLabel={currentTargetLabel}
            currentDocumentId={currentDocumentId}
            currentDocumentVersions={currentDocumentVersions}
            savedDocuments={savedDocuments}
            isLoadingDocuments={isLoadingDocuments}
            isLoadingVersions={isLoadingVersions}
            recoverySnapshot={recoverySnapshot}
            onRestoreRecovery={handleRestoreRecovery}
            onDiscardRecovery={discardRecovery}
            onOpenDocument={handleOpenSavedDocument}
            onRenameDocument={handleRenameSavedDocument}
            onDeleteDocument={handleDeleteSavedDocument}
            onDuplicateDocument={handleDuplicateSavedDocument}
            onDownloadDocument={handleDownloadSavedDocument}
            onRefreshDocuments={handleRefreshDocuments}
            onRestoreVersion={handleRestoreVersion}
            onDownloadVersion={handleDownloadVersion}
          />
        )}
      </main>

      <ShortcutHelpModal isOpen={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />

      <CommandPalette 
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        documents={savedDocuments}
        anchors={anchors}
        actions={commandActions}
        onOpenDocument={handleOpenSavedDocument}
        onJumpToAnchor={jumpToAnchor}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
