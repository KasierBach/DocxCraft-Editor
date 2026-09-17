import type { EditorMode } from '@eigenpal/docx-editor-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { COMPACT_LAYOUT_MEDIA_QUERY } from '../lib/layoutConstants';

export type { EditorMode };

export const APP_STORE_KEY = 'docxcraft:app-state';

export type OpenDocumentKind = 'sample' | 'saved-document' | 'local-file';

/**
 * Identity of the document the editor has open. The bytes are deliberately not
 * kept here: saved documents are refetched by id, and unsaved edits live in the
 * recovery snapshot store (IndexedDB), so this stays small and serialisable.
 */
export type OpenDocument = {
  kind: OpenDocumentKind;
  documentId: string | null;
  name: string;
};

type Updater<T> = T | ((current: T) => T);

function resolveUpdater<T>(value: Updater<T>, current: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value;
}

function prefersCompactLayout(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches;
}

type AppState = {
  /** What the editor had open, so a refresh can return to it. */
  openDocument: OpenDocument | null;
  editorMode: EditorMode;
  showSidebar: boolean;
  showInfo: boolean;
  setOpenDocument: (document: OpenDocument | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setShowSidebar: (value: Updater<boolean>) => void;
  setShowInfo: (value: Updater<boolean>) => void;
};

/** The durable slice. Everything here is expected to survive a refresh. */
export function defaultAppState() {
  return {
    openDocument: null,
    editorMode: 'editing' as EditorMode,
    showSidebar: !prefersCompactLayout(),
    showInfo: !prefersCompactLayout(),
  };
}

/**
 * The app's durable state. Only this slice is persisted — toasts, loading
 * flags, dialogs and other transient UI stay in component state, because
 * rehydrating those would resurrect a spinner or modal that never resolves.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...defaultAppState(),
      setOpenDocument: (document) => set({ openDocument: document }),
      setEditorMode: (mode) => set({ editorMode: mode }),
      setShowSidebar: (value) =>
        set((state) => ({ showSidebar: resolveUpdater(value, state.showSidebar) })),
      setShowInfo: (value) =>
        set((state) => ({ showInfo: resolveUpdater(value, state.showInfo) })),
    }),
    {
      name: APP_STORE_KEY,
      version: 1,
      partialize: (state) => ({
        openDocument: state.openDocument,
        editorMode: state.editorMode,
        showSidebar: state.showSidebar,
        showInfo: state.showInfo,
      }),
    },
  ),
);

/**
 * Drops the remembered document and layout. Used on sign-out so one user's
 * document is never reopened for the next person on the same machine, and by
 * tests, which share the store singleton.
 */
export function resetAppStore() {
  // Reset first, then clear: setState itself writes the persisted copy back.
  useAppStore.setState(defaultAppState());
  // persist() only attaches its API when a storage backend exists, so under the
  // node test environment (server and script tests) there is nothing to clear.
  if (useAppStore.persist) {
    useAppStore.persist.clearStorage();
  }
}
