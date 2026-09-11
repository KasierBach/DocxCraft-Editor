import { act, renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentLibrary } from './useDocumentLibrary';
import type {
  SavedDocumentSummary,
  SavedDocumentVersionSummary,
} from '../lib/documentApi';

function createApi() {
  return {
    listDocuments: vi.fn(),
    listDocumentVersions: vi.fn(),
    saveDocument: vi.fn(),
    readDocumentContent: vi.fn(),
    readDocumentVersionContent: vi.fn(),
    renameDocument: vi.fn(),
    deleteDocument: vi.fn(),
    duplicateDocument: vi.fn(),
  };
}

const EXISTING_DOCUMENT: SavedDocumentSummary = {
  id: 'doc-1',
  name: 'Proposal.docx',
  createdAt: '2026-05-25T05:20:00.000Z',
  updatedAt: '2026-05-25T05:21:00.000Z',
  sizeInBytes: 1024,
  lastOpenedAt: null,
  versionCount: 1,
};

const EXISTING_VERSIONS: SavedDocumentVersionSummary[] = [
  {
    id: 'ver-1',
    documentId: 'doc-1',
    name: 'Proposal.docx',
    createdAt: '2026-05-25T05:21:00.000Z',
    sizeInBytes: 1024,
  },
];

describe('useDocumentLibrary', () => {
  let api: ReturnType<typeof createApi>;

  beforeEach(() => {
    api = createApi();
    api.listDocuments.mockResolvedValue([EXISTING_DOCUMENT]);
    api.listDocumentVersions.mockResolvedValue(EXISTING_VERSIONS);
  });

  it('loads saved documents on mount', async () => {
    const { result } = renderHook(() =>
      useDocumentLibrary({ initialDocumentName: 'Built-in sample', api }),
    );

    await waitFor(() => {
      expect(result.current.savedDocuments).toEqual([EXISTING_DOCUMENT]);
    });

    expect(result.current.documentName).toBe('Built-in sample');
    expect(result.current.currentDocumentId).toBeNull();
  });

  it('saves the current draft and reopens an existing document with versions', async () => {
    const createdDocument: SavedDocumentSummary = {
      id: 'doc-2',
      name: 'Local Draft.docx',
      createdAt: '2026-05-25T05:23:00.000Z',
      updatedAt: '2026-05-25T05:23:00.000Z',
      sizeInBytes: 4,
      lastOpenedAt: null,
      versionCount: 1,
    };
    const createdVersions: SavedDocumentVersionSummary[] = [
      {
        id: 'ver-2',
        documentId: 'doc-2',
        name: 'Local Draft.docx',
        createdAt: '2026-05-25T05:23:00.000Z',
        sizeInBytes: 4,
      },
    ];

    api.saveDocument.mockResolvedValue(createdDocument);
    api.listDocuments
      .mockResolvedValueOnce([EXISTING_DOCUMENT])
      .mockResolvedValueOnce([createdDocument, EXISTING_DOCUMENT]);
    api.listDocumentVersions.mockImplementation(async (documentId: string) =>
      documentId === 'doc-2' ? createdVersions : EXISTING_VERSIONS,
    );
    api.readDocumentContent.mockResolvedValue(new Uint8Array([9, 8, 7]).buffer);

    const { result } = renderHook(() =>
      useDocumentLibrary({ initialDocumentName: 'Built-in sample', api }),
    );

    await waitFor(() => {
      expect(result.current.savedDocuments).toEqual([EXISTING_DOCUMENT]);
    });

    act(() => {
      result.current.setCurrentDraft({ name: 'Local Draft.docx', documentId: null });
    });
    expect(result.current.documentName).toBe('Local Draft.docx');

    let saved: SavedDocumentSummary;
    await act(async () => {
      saved = await result.current.saveCurrentDocument(new Uint8Array([1, 2, 3, 4]).buffer);
    });

    expect(saved!).toEqual(createdDocument);
    expect(api.saveDocument).toHaveBeenCalledWith({
      name: 'Local Draft.docx',
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
    });
    await waitFor(() => {
      expect(result.current.currentDocumentId).toBe('doc-2');
      expect(result.current.documentName).toBe('Local Draft.docx');
      expect(result.current.currentDocumentVersions).toEqual(createdVersions);
    });

    api.listDocuments.mockResolvedValue([EXISTING_DOCUMENT]);
    api.listDocumentVersions.mockImplementation(async () => EXISTING_VERSIONS);

    let opened: Awaited<ReturnType<typeof result.current.openSavedDocument>>;
    await act(async () => {
      opened = await result.current.openSavedDocument('doc-1');
    });

    expect(api.readDocumentContent).toHaveBeenCalledWith('doc-1', { markOpened: true });
    expect(opened!).toEqual({
      id: 'doc-1',
      name: 'Proposal.docx',
      buffer: new Uint8Array([9, 8, 7]).buffer,
    });
    expect(result.current.currentDocumentId).toBe('doc-1');
    expect(result.current.documentName).toBe('Proposal.docx');
    expect(result.current.currentDocumentVersions).toEqual(EXISTING_VERSIONS);
  });

  it('renames, duplicates, restores versions, and deletes saved documents', async () => {
    const renamedDocument: SavedDocumentSummary = {
      ...EXISTING_DOCUMENT,
      name: 'Proposal Renamed.docx',
      updatedAt: '2026-05-25T05:30:00.000Z',
    };
    const duplicatedDocument: SavedDocumentSummary = {
      id: 'doc-2',
      name: 'Proposal Copy.docx',
      createdAt: '2026-05-25T05:31:00.000Z',
      updatedAt: '2026-05-25T05:31:00.000Z',
      sizeInBytes: 1024,
      lastOpenedAt: null,
      versionCount: 1,
    };
    const restoredDocument: SavedDocumentSummary = {
      ...renamedDocument,
      updatedAt: '2026-05-25T05:32:00.000Z',
      versionCount: 2,
    };
    const restoredVersions: SavedDocumentVersionSummary[] = [
      {
        id: 'ver-2',
        documentId: 'doc-1',
        name: 'Proposal Renamed.docx',
        createdAt: '2026-05-25T05:32:00.000Z',
        sizeInBytes: 1024,
      },
      ...EXISTING_VERSIONS,
    ];

    api.renameDocument.mockResolvedValue(renamedDocument);
    api.readDocumentContent.mockResolvedValue(new Uint8Array([9, 8, 7]).buffer);
    api.saveDocument.mockResolvedValue(restoredDocument);
    api.readDocumentVersionContent.mockResolvedValue(new Uint8Array([5, 5, 5]).buffer);
    api.deleteDocument.mockResolvedValue(undefined);
    api.duplicateDocument.mockResolvedValue(duplicatedDocument);
    api.listDocuments
      .mockResolvedValueOnce([EXISTING_DOCUMENT])
      .mockResolvedValueOnce([renamedDocument])
      .mockResolvedValueOnce([duplicatedDocument, renamedDocument])
      .mockResolvedValueOnce([restoredDocument, duplicatedDocument])
      .mockResolvedValueOnce([]);
    api.listDocumentVersions.mockImplementation(async () => EXISTING_VERSIONS);

    const { result } = renderHook(() =>
      useDocumentLibrary({ initialDocumentName: 'Proposal.docx', api }),
    );

    await waitFor(() => {
      expect(result.current.savedDocuments).toEqual([EXISTING_DOCUMENT]);
    });

    act(() => {
      result.current.setCurrentDraft({ name: 'Proposal.docx', documentId: 'doc-1' });
    });

    await act(async () => {
      await result.current.refreshVersions('doc-1');
    });

    let renamed: SavedDocumentSummary;
    await act(async () => {
      renamed = await result.current.renameSavedDocument('doc-1', 'Proposal Renamed.docx');
    });

    expect(renamed!).toEqual(renamedDocument);
    expect(result.current.documentName).toBe('Proposal Renamed.docx');

    let duplicated: SavedDocumentSummary;
    await act(async () => {
      duplicated = await result.current.duplicateSavedDocument('doc-1');
    });

    expect(duplicated!).toEqual(duplicatedDocument);
    expect(api.duplicateDocument).toHaveBeenCalledWith('doc-1');

    let restored: Awaited<ReturnType<typeof result.current.restoreDocumentVersion>>;
    await act(async () => {
      restored = await result.current.restoreDocumentVersion('doc-1', 'ver-1');
    });

    expect(api.readDocumentVersionContent).toHaveBeenCalledWith('doc-1', 'ver-1');
    expect(restored!).toEqual({
      document: restoredDocument,
      buffer: new Uint8Array([5, 5, 5]).buffer,
    });
    api.listDocumentVersions.mockImplementation(async () => restoredVersions);
    await act(async () => {
      await result.current.refreshVersions('doc-1');
    });
    expect(result.current.currentDocumentVersions).toEqual(restoredVersions);

    await act(async () => {
      await result.current.deleteSavedDocument('doc-1');
    });

    expect(api.deleteDocument).toHaveBeenCalledWith('doc-1');
    expect(result.current.currentDocumentId).toBeNull();
  });
});
