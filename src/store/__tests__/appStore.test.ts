import { beforeEach, describe, expect, it } from 'vitest';

import { APP_STORE_KEY, resetAppStore, useAppStore } from '../appStore';

describe('appStore', () => {
  beforeEach(() => {
    resetAppStore();
  });

  it('starts with no remembered document and editing mode', () => {
    const state = useAppStore.getState();
    expect(state.openDocument).toBeNull();
    expect(state.editorMode).toBe('editing');
  });

  it('remembers the open document', () => {
    useAppStore
      .getState()
      .setOpenDocument({ kind: 'saved-document', documentId: 'doc-1', name: 'A.docx' });

    expect(useAppStore.getState().openDocument).toEqual({
      kind: 'saved-document',
      documentId: 'doc-1',
      name: 'A.docx',
    });
  });

  it('accepts an updater for the drawer setters', () => {
    useAppStore.getState().setShowSidebar(false);
    useAppStore.getState().setShowSidebar((current) => !current);

    expect(useAppStore.getState().showSidebar).toBe(true);
  });

  it('persists only the durable slice', () => {
    useAppStore.getState().setEditorMode('viewing');

    const raw = window.localStorage.getItem(APP_STORE_KEY);
    expect(raw).toBeTruthy();

    const persisted = JSON.parse(raw ?? '{}') as { state: Record<string, unknown>; version: number };
    expect(Object.keys(persisted.state).sort()).toEqual([
      'editorMode',
      'openDocument',
      'showInfo',
      'showSidebar',
    ]);
    expect(persisted.version).toBe(1);
  });

  it('rehydrates the remembered document and layout', async () => {
    window.localStorage.setItem(
      APP_STORE_KEY,
      JSON.stringify({
        state: {
          openDocument: {
            kind: 'saved-document',
            documentId: 'doc-9',
            name: 'Nine.docx',
          },
          editorMode: 'suggesting',
          showSidebar: false,
          showInfo: true,
        },
        version: 1,
      }),
    );

    await useAppStore.persist.rehydrate();

    const state = useAppStore.getState();
    expect(state.openDocument).toMatchObject({ documentId: 'doc-9', name: 'Nine.docx' });
    expect(state.editorMode).toBe('suggesting');
    expect(state.showSidebar).toBe(false);
    expect(state.showInfo).toBe(true);
  });

  it('drops the persisted copy on reset', () => {
    useAppStore
      .getState()
      .setOpenDocument({ kind: 'sample', documentId: null, name: 'Built-in sample.docx' });

    resetAppStore();

    expect(useAppStore.getState().openDocument).toBeNull();
    expect(window.localStorage.getItem(APP_STORE_KEY)).toBeNull();
  });
});
