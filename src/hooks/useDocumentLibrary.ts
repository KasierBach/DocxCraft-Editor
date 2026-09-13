import { useCallback, useEffect, useRef, useState } from 'react';

import { describeCommandError } from '../lib/errors';

import {
  deleteDocument,
  listDocuments,
  listDocumentVersions,
  readDocumentContent,
  readDocumentVersionContent,
  renameDocument,
  saveDocument,
  duplicateDocument,
  type SavedDocumentSummary,
  type SavedDocumentVersionSummary,
} from '../lib/documentApi';

type DocumentLibraryApi = {
  listDocuments: typeof listDocuments;
  listDocumentVersions: typeof listDocumentVersions;
  saveDocument: typeof saveDocument;
  readDocumentContent: typeof readDocumentContent;
  readDocumentVersionContent: typeof readDocumentVersionContent;
  renameDocument: typeof renameDocument;
  deleteDocument: typeof deleteDocument;
  duplicateDocument: typeof duplicateDocument;
};

const defaultApi: DocumentLibraryApi = {
  listDocuments,
  listDocumentVersions,
  saveDocument,
  readDocumentContent,
  readDocumentVersionContent,
  renameDocument,
  deleteDocument,
  duplicateDocument,
};

type UseDocumentLibraryOptions = {
  initialDocumentName: string;
  api?: DocumentLibraryApi;
};

type DraftDescriptor = {
  name: string;
  documentId: string | null;
};

type OpenedDocument = {
  id: string;
  name: string;
  buffer: ArrayBuffer;
};

type SaveDocumentOptions = {
  asNew?: boolean;
  name?: string;
};

const FALLBACK_DOCUMENT_NAME = 'Untitled.docx';


export function useDocumentLibrary({ initialDocumentName, api = defaultApi }: UseDocumentLibraryOptions) {
  const [documentName, setDocumentName] = useState(initialDocumentName);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [currentDocumentRevision, setCurrentDocumentRevision] = useState<number | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocumentSummary[]>([]);
  const [currentDocumentVersions, setCurrentDocumentVersions] = useState<
    SavedDocumentVersionSummary[]
  >([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  // Ref mirror of isSaving so rapid re-entry is rejected before the next
  // render commits the state update.
  const isSavingRef = useRef(false);

  const refreshDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);

    try {
      const documents = await api.listDocuments();
      setSavedDocuments(documents);
      setLibraryError(null);
      return documents;
    } catch (error) {
      const message = describeCommandError(error, 'Failed to load saved documents.');
      setLibraryError(message);
      throw error;
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [api]);

  const refreshVersions = useCallback(async (documentId = currentDocumentId) => {
    if (!documentId) {
      setCurrentDocumentVersions([]);
      setVersionError(null);
      return [];
    }

    setIsLoadingVersions(true);

    try {
      const versions = await api.listDocumentVersions(documentId);
      setCurrentDocumentVersions(versions);
      setVersionError(null);
      return versions;
    } catch (error) {
      const message = describeCommandError(error, 'Failed to load versions.');
      setVersionError(message);
      throw error;
    } finally {
      setIsLoadingVersions(false);
    }
  }, [api, currentDocumentId]);

  useEffect(() => {
    void refreshDocuments().catch(() => undefined);
  }, [refreshDocuments]);

  useEffect(() => {
    void refreshVersions().catch(() => undefined);
  }, [currentDocumentId, refreshVersions]);

  const setCurrentDraft = useCallback(({ name, documentId }: DraftDescriptor) => {
    setDocumentName(name);
    setCurrentDocumentId(documentId);
    setCurrentDocumentRevision(null);
    setLibraryError(null);
    if (documentId === null) {
      setCurrentDocumentVersions([]);
      setVersionError(null);
    }
  }, []);

  const saveCurrentDocument = useCallback(
    async (buffer: ArrayBuffer, options?: SaveDocumentOptions): Promise<SavedDocumentSummary> => {
      if (isSavingRef.current) {
        throw new Error('A save is already in progress.');
      }

      isSavingRef.current = true;
      setIsSaving(true);

      try {
        const name = options?.name ?? documentName;
        const documentIdForUpdate =
          !options?.asNew && currentDocumentId ? currentDocumentId : null;
        const isUpdate = documentIdForUpdate !== null;
        let currentSavedDocument = isUpdate
          ? savedDocuments.find((document) => document.id === documentIdForUpdate)
          : undefined;

        // A stale local list can be missing the current document; refetch it so
        // updates always carry an If-Match revision instead of overwriting
        // unconditionally.
        if (isUpdate && !currentSavedDocument) {
          const documents = await api.listDocuments();
          setSavedDocuments(documents);
          currentSavedDocument = documents.find(
            (document) => document.id === documentIdForUpdate,
          );
        }

        const revision = currentSavedDocument?.revision ?? currentDocumentRevision;
        const saveInput = {
          name,
          buffer,
          ...(isUpdate ? { id: documentIdForUpdate } : {}),
          ...(isUpdate && revision ? { revision } : {}),
        };
        const savedDocument = await api.saveDocument(saveInput);

        setCurrentDocumentId(savedDocument.id);
        setCurrentDocumentRevision(savedDocument.revision ?? null);
        setDocumentName(savedDocument.name);
        setLibraryError(null);
        await refreshDocuments();
        await refreshVersions(savedDocument.id);
        return savedDocument;
      } catch (error) {
        const message = describeCommandError(error, 'Failed to save document.');
        setLibraryError(message);
        throw error;
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [
      api,
      currentDocumentId,
      currentDocumentRevision,
      documentName,
      refreshDocuments,
      refreshVersions,
      savedDocuments,
    ],
  );

  const openSavedDocument = useCallback(
    async (documentId: string): Promise<OpenedDocument> => {
      const buffer = await api.readDocumentContent(documentId, { markOpened: true });
      const documents =
        savedDocuments.find((document) => document.id === documentId) === undefined
          ? await refreshDocuments()
          : savedDocuments;
      const matchingDocument = documents.find((document) => document.id === documentId) ?? null;

      const name = matchingDocument?.name ?? FALLBACK_DOCUMENT_NAME;
      const isSameDocument = documentId === currentDocumentId;
      setCurrentDocumentId(documentId);
      setCurrentDocumentRevision(matchingDocument?.revision ?? null);
      setDocumentName(name);
      setLibraryError(null);

      // Reopening the current document does not change currentDocumentId, so
      // the version effect will not re-run; refresh explicitly in that case.
      if (isSameDocument) {
        await refreshVersions(documentId);
      }

      return {
        id: documentId,
        name,
        buffer,
      };
    },
    [api, currentDocumentId, refreshDocuments, refreshVersions, savedDocuments],
  );

  const renameSavedDocument = useCallback(
    async (documentId: string, name: string) => {
      try {
        const renamedDocument = await api.renameDocument(documentId, name);
        if (documentId === currentDocumentId) {
          setDocumentName(renamedDocument.name);
          setCurrentDocumentRevision(renamedDocument.revision ?? null);
        }
        setLibraryError(null);
        await refreshDocuments();
        return renamedDocument;
      } catch (error) {
        const message = describeCommandError(error, 'Failed to rename document.');
        setLibraryError(message);
        throw error;
      }
    },
    [api, currentDocumentId, refreshDocuments],
  );

  const deleteSavedDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        await api.deleteDocument(documentId);
        if (documentId === currentDocumentId) {
          setCurrentDocumentId(null);
          setCurrentDocumentRevision(null);
          setCurrentDocumentVersions([]);
        }
        setLibraryError(null);
        await refreshDocuments();
        return true;
      } catch (error) {
        const message = describeCommandError(error, 'Failed to delete document.');
        setLibraryError(message);
        throw error;
      }
    },
    [api, currentDocumentId, refreshDocuments],
  );

  const duplicateSavedDocument = useCallback(
    async (documentId: string) => {
      const duplicatedDocument = await api.duplicateDocument(documentId);
      await refreshDocuments();
      return duplicatedDocument;
    },
    [api, refreshDocuments],
  );

  const restoreDocumentVersion = useCallback(
    async (documentId: string, versionId: string) => {
      const buffer = await api.readDocumentVersionContent(documentId, versionId);
      const matchingDocument =
        savedDocuments.find((document) => document.id === documentId) ??
        (await refreshDocuments()).find((document) => document.id === documentId) ??
        null;

      const restoredDocument = await api.saveDocument({
        id: documentId,
        name: matchingDocument?.name ?? documentName,
        buffer,
        revision: matchingDocument?.revision,
      });

      if (documentId === currentDocumentId) {
        setDocumentName(restoredDocument.name);
        setCurrentDocumentRevision(restoredDocument.revision ?? null);
      }

      await refreshDocuments();
      await refreshVersions(documentId);
      return {
        document: restoredDocument,
        buffer,
      };
    },
    [api, currentDocumentId, documentName, refreshDocuments, refreshVersions, savedDocuments],
  );

  const readSavedDocumentBuffer = useCallback((documentId: string) => {
    return api.readDocumentContent(documentId, { markOpened: false });
  }, [api]);

  const readVersionBuffer = useCallback((documentId: string, versionId: string) => {
    return api.readDocumentVersionContent(documentId, versionId);
  }, [api]);

  return {
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
  };
}
