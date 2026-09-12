import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DocxEditor, type DocxEditorRef, type EditorMode } from '@eigenpal/docx-editor-react';
import type { Document } from '@eigenpal/docx-editor-core';
import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror';

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
import { useDocumentCommands } from './hooks/useDocumentCommands';
import { useTheme } from './hooks/useTheme';
import { useDocumentLibrary } from './hooks/useDocumentLibrary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRecoveryDraft } from './hooks/useRecoveryDraft';
import { useToastManager } from './hooks/useToastManager';
import { collectAnchorTargets, type AnchorTarget, type PageContent } from './lib/anchors';
import { buildDeepLinkSearch, readDeepLink } from './lib/deepLink';
import { downloadBufferAsDocx } from './lib/download';
import { convertToMarkdown, downloadMarkdown } from './lib/exportUtils';
import { COMPACT_LAYOUT_MEDIA_QUERY } from './lib/layoutConstants';
import { flashParagraphHighlight } from './lib/flashHighlight';
import { scanForMedia, type MediaItem } from './lib/mediaScanner';
import type { RecoverySnapshot } from './lib/recoveryStore';
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

type ShortcutSpec = {
  id: string;
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  description: string;
};

// Single source of truth for shortcut bindings and the help modal: handlers
// are attached by id in the component, so the two can never drift apart.
const SHORTCUT_SPECS = [
  { id: 'save', key: 's', ctrlKey: true, description: 'Save current document' },
  { id: 'open', key: 'o', ctrlKey: true, description: 'Open .docx from computer' },
  { id: 'save-as', key: 's', ctrlKey: true, shiftKey: true, description: 'Save as new document' },
  { id: 'help', key: '/', ctrlKey: true, description: 'Show or hide shortcut help' },
  { id: 'outline', key: '\\', ctrlKey: true, description: 'Toggle document outline' },
  { id: 'details', key: 'i', ctrlKey: true, description: 'Toggle document details' },
  { id: 'palette', key: 'p', ctrlKey: true, description: 'Open command palette' },
] as const satisfies ReadonlyArray<ShortcutSpec>;

type ShortcutId = (typeof SHORTCUT_SPECS)[number]['id'];

const SAMPLE_DOCUMENT_NAME = 'Built-in sample.docx';

const ANCHOR_REFRESH_FIRST_DELAY_MS = 180;
const ANCHOR_REFRESH_RETRY_DELAY_MS = 250;
const ANCHOR_REFRESH_DEFAULT_ATTEMPTS = 10;

function prefersCompactLayout(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  try {
    return window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

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

function areAnchorsEqual(currentAnchors: AnchorTarget[], nextAnchors: AnchorTarget[]) {
  if (currentAnchors.length !== nextAnchors.length) {
    return false;
  }

  for (let index = 0; index < currentAnchors.length; index += 1) {
    const current = currentAnchors[index];
    const next = nextAnchors[index];

    if (
      current?.id !== next?.id ||
      current?.label !== next?.label ||
      current?.pageNumber !== next?.pageNumber ||
      current?.styleId !== next?.styleId
    ) {
      return false;
    }
  }

  return true;
}

export default function App() {

  const editorRef = useRef<DocxEditorRef>(null);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const ignoreContentChangeUntilRef = useRef(0);
  const lastSelectionStateRef = useRef<SelectionState | null>(null);
  const activeParaIdRef = useRef<string | null>(null);
  const anchorsRef = useRef<AnchorTarget[]>([]);
  const lastLibraryErrorRef = useRef<string | null>(null);
  const lastVersionErrorRef = useRef<string | null>(null);
  const flashHighlightCancelRef = useRef<(() => void) | null>(null);

  const initialDeepLink = useMemo(() => readDeepLink(window.location.search), []);
  const [source, setSource] = useState<EditorSource>(() => createSampleSource());
  const [editorKey, setEditorKey] = useState(0);
  const [pendingDeepLinkParaId, setPendingDeepLinkParaId] = useState<string | null>(
    initialDeepLink.paraId,
  );
  const [currentPage, setCurrentPage] = useState<number | null>(1);
  const [statusMessage, setStatusMessage] = useState('Ready.');
  const [isDirty, setIsDirty] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => !prefersCompactLayout());
  const [showInfo, setShowInfo] = useState(() => !prefersCompactLayout());
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('editing');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const hasHandledInitialDeepLink = useRef(false);

  // Use toast manager hook
  const { toasts, pushToast, dismissToast } = useToastManager();

  const { runCommand } = useDocumentCommands({ pushToast, setStatusMessage });

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

  const { theme, toggleTheme } = useTheme();

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

  const getEditorBuffer = useCallback(async () => {
    try {
      return (await editorRef.current?.save()) ?? null;
    } catch {
      return null;
    }
  }, []);

  const recoveryAutosaveDelayMs = source.kind === 'saved-document' ? 5000 : 2500;

  const { recoverySnapshot, discardRecovery } = useRecoveryDraft({
    sourceKind: source.kind,
    documentId: currentDocumentId,
    documentName,
    activeParaId,
    isDirty,
    getBuffer: getEditorBuffer,
    autosaveDelayMs: recoveryAutosaveDelayMs,
  });

  const confirmDiscardChanges = useCallback(() => {
    return !isDirty || window.confirm('Discard the unsaved changes in the current document?');
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const currentTargetLabel = useMemo(
    () => anchors.find((anchor) => anchor.id === activeParaId)?.label ?? 'No paragraph selected',
    [activeParaId, anchors],
  );

  useEffect(() => {
    activeParaIdRef.current = activeParaId;
  }, [activeParaId]);

  useEffect(() => {
    anchorsRef.current = anchors;
  }, [anchors]);

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

    setPageCount(totalPages);
    setWordCount(
      editor.getAgent()?.getWordCount() ??
      pages.reduce((count, page) => count + (page.text.match(/\S+/g)?.length ?? 0), 0),
    );
    setMediaItems(scanForMedia(editor));

    const nextAnchors = collectAnchorTargets(pages);
    const nextActiveParaId = resolveActiveAnchorId({
      anchors: nextAnchors,
      selectionInfo: editor.getSelectionInfo(),
      selectionState: lastSelectionStateRef.current,
      fallbackActiveParaId: activeParaIdRef.current,
      preferFirstAnchor: true,
    });
    const anchorsChanged = !areAnchorsEqual(anchorsRef.current, nextAnchors);

    startTransition(() => {
      if (anchorsChanged) {
        setAnchors(nextAnchors);
      }
      setActiveParaId(nextActiveParaId);
      setCurrentPage(editor.getCurrentPage());
    });

    if (anchorsChanged && nextAnchors.length > 0) {
      setStatusMessage(`Indexed ${nextAnchors.length} paragraphs across ${totalPages} pages.`);
    }

    return nextAnchors.length > 0;
  }, [setActiveParaId, setAnchors]);

  const scheduleAnchorRefresh = useCallback(
    (attempts = ANCHOR_REFRESH_DEFAULT_ATTEMPTS) => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      const schedule = (remaining: number, isFirstAttempt: boolean) => {
        refreshTimerRef.current = window.setTimeout(() => {
          const refreshWorked = refreshAnchors();
          if (!refreshWorked && remaining > 1) {
            schedule(remaining - 1, false);
          }
        }, isFirstAttempt ? ANCHOR_REFRESH_FIRST_DELAY_MS : ANCHOR_REFRESH_RETRY_DELAY_MS);
      };

      schedule(attempts, true);
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

  const loadBuiltInSample = useCallback((skipConfirmation = false) => {
    if (!skipConfirmation && !confirmDiscardChanges()) return;

    loadEditorSource(createSampleSource());
    setCurrentDraft({ name: SAMPLE_DOCUMENT_NAME, documentId: null });
    setPendingDeepLinkParaId(initialDeepLink.source === 'sample' ? initialDeepLink.paraId : null);
    discardRecovery();
    setStatusMessage('Sample reloaded.');
    pushToast('info', 'Sample reloaded.');
  }, [confirmDiscardChanges, discardRecovery, initialDeepLink.paraId, initialDeepLink.source, loadEditorSource, pushToast, setCurrentDraft]);

  const restoreRecoverySnapshot = useCallback(
    (snapshot: RecoverySnapshot) => {
      hasHandledInitialDeepLink.current = true;

      if (snapshot.sourceKind === 'saved-document' && snapshot.documentId) {
        loadEditorSource({
          kind: 'saved-document',
          name: snapshot.documentName,
          documentId: snapshot.documentId,
          buffer: snapshot.buffer,
        });
        setCurrentDraft({
          name: snapshot.documentName,
          documentId: snapshot.documentId,
        });
        void refreshVersions(snapshot.documentId).catch(() => undefined);
      } else {
        loadEditorSource({
          kind: 'local-file',
          name: snapshot.documentName,
          buffer: snapshot.buffer,
        });
        setCurrentDraft({
          name: snapshot.documentName,
          documentId: null,
        });
      }

      setPendingDeepLinkParaId(snapshot.activeParaId);
      setIsDirty(true);
      discardRecovery();

      const message = `Restored unsaved work for ${snapshot.documentName}.`;

      setStatusMessage(message);
      pushToast('info', message);
    },
    [discardRecovery, loadEditorSource, pushToast, refreshVersions, setCurrentDraft],
  );

  useEffect(() => {
    let isCancelled = false;
    const deepLinkDocumentId = initialDeepLink.documentId;

    if (
      !hasHandledInitialDeepLink.current &&
      initialDeepLink.source === 'saved' &&
      deepLinkDocumentId
    ) {
      hasHandledInitialDeepLink.current = true;
      void (async () => {
        try {
          const openedDocument = await openSavedDocument(deepLinkDocumentId);
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

  // On compact (drawer) layouts, only one drawer is shown at a time; on
  // desktop both sidebars toggle independently.
  const handleToggleSidebar = useCallback(() => {
    const opening = !showSidebar;
    setShowSidebar(opening);
    if (opening && prefersCompactLayout()) {
      setShowInfo(false);
    }
  }, [showSidebar]);

  const handleToggleInfo = useCallback(() => {
    const opening = !showInfo;
    setShowInfo(opening);
    if (opening && prefersCompactLayout()) {
      setShowSidebar(false);
    }
  }, [showInfo]);

  const closeDrawers = useCallback(() => {
    setShowSidebar(false);
    setShowInfo(false);
  }, []);

  const closeSidebar = useCallback(() => {
    setShowSidebar(false);
  }, []);

  const closeInfo = useCallback(() => {
    setShowInfo(false);
  }, []);

  // Escape closes open drawers on compact (drawer) layouts without touching
  // dialogs such as the command palette or the shortcut help modal.
  useEffect(() => {
    if (!showSidebar && !showInfo) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      if (showCommandPalette || showShortcutHelp) {
        return;
      }

      if (!prefersCompactLayout()) {
        return;
      }

      closeDrawers();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDrawers, showCommandPalette, showShortcutHelp, showInfo, showSidebar]);

  const handleHeaderRefresh = useCallback(() => {
    scheduleAnchorRefresh();
  }, [scheduleAnchorRefresh]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!confirmDiscardChanges()) {
        event.target.value = '';
        return;
      }

      try {
        if (!/\.docx$/i.test(file.name) || file.size > 50 * 1024 * 1024) {
          throw new Error('Choose a .docx file no larger than 50 MiB.');
        }

        const buffer = await file.arrayBuffer();
        const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
        if (signature.length < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
          throw new Error('The selected file is not a valid DOCX document.');
        }
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
    [confirmDiscardChanges, loadEditorSource, pushToast, setCurrentDraft],
  );

  const handleSaveDocument = useCallback(async () => {
    if (isSaving) return;

    const buffer = await getEditorBuffer();
    if (!buffer) {
      setStatusMessage('Save failed.');
      pushToast('error', 'The editor did not return a document buffer.');
      return;
    }

    const savedDocument = await runCommand('Save', () => saveCurrentDocument(buffer), {
      successMessage: (result) =>
        source.kind === 'saved-document'
          ? `Changes saved to "${result.name}"`
          : `Document "${result.name}" saved to library`,
    });
    if (!savedDocument) {
      return;
    }

    if (source.kind !== 'saved-document') {
      rememberSavedSource(savedDocument.id, savedDocument.name, buffer);
    }

    discardRecovery();
    setIsDirty(false);
    setLastSavedAt(new Date().toISOString());
  }, [
    discardRecovery,
    getEditorBuffer,
    isSaving,
    pushToast,
    rememberSavedSource,
    runCommand,
    saveCurrentDocument,
    source.kind,
  ]);

  const handleSaveAsDocument = useCallback(async () => {
    if (isSaving) return;

    const buffer = await getEditorBuffer();
    if (!buffer) {
      setStatusMessage('Save as failed.');
      pushToast('error', 'The editor did not return a document buffer.');
      return;
    }

    const savedDocument = await runCommand(
      'Save as',
      () => saveCurrentDocument(buffer, { asNew: true, name: documentName }),
      { successMessage: (result) => `Saved ${result.name} as a new document.` },
    );
    if (!savedDocument) {
      return;
    }

    loadEditorSource({
      kind: 'saved-document',
      name: savedDocument.name,
      documentId: savedDocument.id,
      buffer,
    });
    discardRecovery();
    setLastSavedAt(new Date().toISOString());
  }, [
    discardRecovery,
    documentName,
    getEditorBuffer,
    isSaving,
    loadEditorSource,
    pushToast,
    runCommand,
    saveCurrentDocument,
  ]);

  const handleDownloadCurrent = useCallback(async () => {
    const buffer = await getEditorBuffer();
    if (!buffer) {
      setStatusMessage('Download failed.');
      pushToast('error', 'The editor did not return a document buffer.');
      return;
    }

    downloadBufferAsDocx(documentName, buffer);
    setStatusMessage(`Downloaded ${documentName}.`);
    pushToast('success', `Downloaded ${documentName}.`);
  }, [documentName, getEditorBuffer, pushToast]);

  const handleOpenSavedDocument = useCallback(
    async (documentId: string) => {
      if (!confirmDiscardChanges()) return;

      const openedDocument = await runCommand(
        'Open',
        () => openSavedDocument(documentId),
        {
          successMessage: (result) => `Opened ${result.name} from the local library.`,
        },
      );
      if (!openedDocument) {
        return;
      }

      loadEditorSource({
        kind: 'saved-document',
        name: openedDocument.name,
        documentId: openedDocument.id,
        buffer: openedDocument.buffer,
      });
    },
    [confirmDiscardChanges, loadEditorSource, openSavedDocument, runCommand],
  );

  const handleReloadDocument = useCallback(async () => {
    if (!confirmDiscardChanges()) return;

    if (source.kind === 'sample') {
      loadBuiltInSample(true);
      return;
    }

    if (source.kind === 'saved-document' && currentDocumentId === source.documentId) {
      const reopenedDocument = await runCommand(
        'Reload',
        () => openSavedDocument(source.documentId),
        {
          successMessage: (result) => `Reloaded ${result.name} from the local library.`,
          successTone: 'info',
        },
      );
      if (!reopenedDocument) {
        return;
      }

      loadEditorSource({
        kind: 'saved-document',
        name: reopenedDocument.name,
        documentId: reopenedDocument.id,
        buffer: reopenedDocument.buffer,
      });
      discardRecovery();
      return;
    }

    loadEditorSource({
      ...source,
      buffer: source.buffer.slice(0),
    });
    discardRecovery();
    setStatusMessage(`Reloaded ${source.name}.`);
    pushToast('info', `Reloaded ${source.name}.`);
  }, [
    confirmDiscardChanges,
    currentDocumentId,
    discardRecovery,
    loadBuiltInSample,
    loadEditorSource,
    openSavedDocument,
    pushToast,
    runCommand,
    source,
  ]);

  const handleExportMarkdown = useCallback(() => {
    if (!editorRef.current) return;
    try {
      const markdown = convertToMarkdown(editorRef.current);
      downloadMarkdown(documentName || 'document', markdown);
      pushToast('success', 'Document exported as Markdown.');
    } catch {
      pushToast('error', 'Failed to export Markdown.');
    }
  }, [documentName, pushToast]);

  const handlePrintPDF = useCallback(() => {
    editorRef.current?.openPrintPreview();
  }, []);

  const handleRefreshDocuments = useCallback(async () => {
    await runCommand('Refresh', () => refreshDocuments(), {
      successMessage: () => 'Saved documents refreshed.',
    });
  }, [refreshDocuments, runCommand]);

  const handleRenameSavedDocument = useCallback(
    async (documentId: string, name: string) => {
      const renamedDocument = await runCommand(
        'Rename',
        () => renameSavedDocument(documentId, name),
        { successMessage: (result) => `Renamed saved document to ${result.name}.` },
      );
      if (!renamedDocument) {
        return;
      }

      if (isSavedSource(source) && source.documentId === documentId) {
        rememberSavedSource(documentId, renamedDocument.name, source.buffer);
      }
    },
    [rememberSavedSource, renameSavedDocument, runCommand, source],
  );

  const handleDeleteSavedDocument = useCallback(
    async (documentId: string) => {
      const deletedDocument = savedDocuments.find((document) => document.id === documentId) ?? null;

      const deletesCurrentDocument = isSavedSource(source) && source.documentId === documentId;
      if (deletesCurrentDocument && !confirmDiscardChanges()) return;

      const deleted = await runCommand(
        'Delete',
        () => deleteSavedDocument(documentId),
        {
          successMessage: () =>
            deletedDocument
              ? `Deleted ${deletedDocument.name} from the local library.`
              : 'Deleted saved document from the local library.',
        },
      );

      if (deletesCurrentDocument && deleted) {
        loadBuiltInSample(true);
      }
    },
    [
      confirmDiscardChanges,
      deleteSavedDocument,
      loadBuiltInSample,
      runCommand,
      savedDocuments,
      source,
    ],
  );

  const handleDuplicateSavedDocument = useCallback(
    async (documentId: string) => {
      await runCommand('Duplicate', () => duplicateSavedDocument(documentId), {
        successMessage: (result) => `Duplicated ${result.name}.`,
      });
    },
    [duplicateSavedDocument, runCommand],
  );

  const handleDownloadSavedDocument = useCallback(
    async (documentId: string) => {
      const savedDocument =
        savedDocuments.find((document) => document.id === documentId) ?? null;
      const name = savedDocument?.name ?? documentName;

      const buffer = await runCommand('Download', () => readSavedDocumentBuffer(documentId), {
        successMessage: () => `Downloaded ${name}.`,
      });
      if (!buffer) {
        return;
      }

      downloadBufferAsDocx(name, buffer);
    },
    [documentName, readSavedDocumentBuffer, runCommand, savedDocuments],
  );

  const handleRestoreVersion = useCallback(
    async (documentId: string, versionId: string) => {
      if (!confirmDiscardChanges()) return;

      const restored = await runCommand(
        'Restore version',
        () => restoreDocumentVersion(documentId, versionId),
        {
          successMessage: (result) => `Restored a saved version of ${result.document.name}.`,
        },
      );
      if (!restored) {
        return;
      }

      loadEditorSource({
        kind: 'saved-document',
        name: restored.document.name,
        documentId,
        buffer: restored.buffer,
      });
      discardRecovery();
    },
    [
      confirmDiscardChanges,
      discardRecovery,
      loadEditorSource,
      restoreDocumentVersion,
      runCommand,
    ],
  );

  const handleDownloadVersion = useCallback(
    async (documentId: string, versionId: string) => {
      const version =
        currentDocumentVersions.find((entry) => entry.id === versionId) ?? null;
      const name = version?.name ?? documentName;

      const buffer = await runCommand(
        'Download version',
        () => readVersionBuffer(documentId, versionId),
        { successMessage: () => `Downloaded ${name}.` },
      );
      if (!buffer) {
        return;
      }

      downloadBufferAsDocx(name, buffer);
    },
    [currentDocumentVersions, documentName, readVersionBuffer, runCommand],
  );

  const handleRestoreRecovery = useCallback(async () => {
    if (!recoverySnapshot) {
      return;
    }
    if (!confirmDiscardChanges()) return;

    await restoreRecoverySnapshot(recoverySnapshot);
  }, [confirmDiscardChanges, recoverySnapshot, restoreRecoverySnapshot]);

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

      const root = editorHostRef.current;
      if (root) {
        flashHighlightCancelRef.current?.();
        flashHighlightCancelRef.current = flashParagraphHighlight(root, window.getSelection());
      }
    },
    [anchors, setActiveParaId],
  );

  const commandActions = useMemo(() => [
    { id: 'save', label: 'Save Document', section: 'Actions', handler: handleSaveDocument },
    { id: 'save-as', label: 'Save As Copy', section: 'Actions', handler: handleSaveAsDocument },
    { id: 'export', label: 'Export to .docx', section: 'Actions', handler: handleDownloadCurrent },
    { id: 'sample', label: 'Load Sample Document', section: 'Actions', handler: loadBuiltInSample },
    { id: 'toggle-sidebar', label: 'Toggle Left Sidebar', section: 'Actions', handler: handleToggleSidebar },
    { id: 'toggle-info', label: 'Toggle Right Sidebar', section: 'Actions', handler: handleToggleInfo },
    {
      id: 'help',
      label: 'Show Keyboard Shortcuts',
      section: 'Actions',
      handler: () => {
        setShowShortcutHelp(true);
        setShowCommandPalette(false);
      },
    },
  ], [handleDownloadCurrent, handleSaveAsDocument, handleSaveDocument, handleToggleInfo, handleToggleSidebar, loadBuiltInSample]);

  const shortcutHandlers: Record<ShortcutId, () => void> = {
    save: handleSaveDocument,
    open: () => {
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".docx"]');
      fileInput?.click();
    },
    'save-as': handleSaveAsDocument,
    help: () => {
      setShowShortcutHelp((show) => !show);
      setShowCommandPalette(false);
    },
    outline: handleToggleSidebar,
    details: handleToggleInfo,
    palette: () => {
      setShowCommandPalette((show) => !show);
      setShowShortcutHelp(false);
    },
  };

  const keyboardShortcuts = SHORTCUT_SPECS.map((spec) => ({
    ...spec,
    handler: shortcutHandlers[spec.id],
  }));

  useKeyboardShortcuts({ shortcuts: keyboardShortcuts, enabled: true });

  // The shortcut matcher accepts Ctrl or Meta (Cmd) interchangeably, so the
  // help modal shows the modifier the visitor's platform actually uses.
  const modifierLabel = useMemo(() => {
    if (typeof navigator === 'undefined') return 'Ctrl';
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'Cmd' : 'Ctrl';
  }, []);

  const shortcutHelpEntries = SHORTCUT_SPECS.map((spec: ShortcutSpec) => ({
    keys: [modifierLabel, ...(spec.shiftKey ? ['Shift'] : []), spec.key.toUpperCase()],
    description: spec.description,
  }));

  return (
    <div className="app-shell">
      <Header
        showSidebar={showSidebar}
        onToggleSidebar={handleToggleSidebar}
        showInfo={showInfo}
        onToggleInfo={handleToggleInfo}
        theme={theme}
        onToggleTheme={toggleTheme}
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
        onRefresh={handleHeaderRefresh}
        sourceKind={source.kind}
        onExportMarkdown={handleExportMarkdown}
        onPrintPDF={handlePrintPDF}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
      />

      {(showSidebar || showInfo) && (
        <div
          className="drawer-backdrop"
          aria-hidden="true"
          onClick={closeDrawers}
        />
      )}

      <main
        className={`workspace ${!showSidebar ? 'sidebar--hidden' : ''} ${!showInfo ? 'info--hidden' : ''
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
            onClose={closeSidebar}
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
              mode={editorMode}
              onModeChange={setEditorMode}
              className="docx-editor-frame"
              onChange={() => {
                if (Date.now() < ignoreContentChangeUntilRef.current) {
                  return;
                }

                setIsDirty(true);
                setStatusMessage('Unsaved changes.');
                scheduleAnchorRefresh();
              }}
              onSelectionChange={(selectionState) => {
                lastSelectionStateRef.current = selectionState;
                const nextActiveParaId = resolveActiveAnchorId({
                  anchors,
                  selectionInfo: editorRef.current?.getSelectionInfo() ?? null,
                  selectionState,
                  fallbackActiveParaId: activeParaIdRef.current,
                });
                const nextCurrentPage = editorRef.current?.getCurrentPage() ?? null;

                startTransition(() => {
                  setActiveParaId(nextActiveParaId);
                  setCurrentPage(nextCurrentPage);
                });
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
            mediaItems={mediaItems}
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
            onJumpToMedia={jumpToAnchor}
            onClose={closeInfo}
          />
        )}
      </main>

      <ShortcutHelpModal
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
        shortcuts={shortcutHelpEntries}
      />

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
