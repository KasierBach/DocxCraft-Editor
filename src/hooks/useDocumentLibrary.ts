import { useCallback, useEffect, useState } from 'react';

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
  const [savedDocuments, setSavedDocuments] = useState<SavedDocumentSummary[]>([]);
  const [currentDocumentVersions, setCurrentDocumentVersions] = useState<
    SavedDocumentVersionSummary[]
  >([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);

    try {
      const documents = await api.listDocuments();
      setSavedDocuments(documents);
      setLibraryError(null);
      return documents;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load saved documents.';
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
      const message = error instanceof Error ? error.message : 'Failed to load versions.';
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
    setLibraryError(null);
    if (documentId === null) {
      setCurrentDocumentVersions([]);
      setVersionError(null);
    }
  }, []);

  const saveCurrentDocument = useCallback(
    async (buffer: ArrayBuffer, options?: SaveDocumentOptions) => {
      setIsSaving(true);

      try {
        const name = options?.name ?? documentName;
        const currentSavedDocument = currentDocumentId
          ? savedDocuments.find((document) => document.id === currentDocumentId)
          : undefined;
        const saveInput = {
          name,
          buffer,
          ...(options?.asNew || !currentDocumentId ? {} : { id: currentDocumentId }),
          ...(currentSavedDocument ? { revision: currentSavedDocument.revision } : {}),
        };
        const savedDocument = await api.saveDocument(saveInput);

        setCurrentDocumentId(savedDocument.id);
        setDocumentName(savedDocument.name);
        setLibraryError(null);
        await refreshDocuments();
        await refreshVersions(savedDocument.id);
        return savedDocument;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save document.';
        setLibraryError(message);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [api, currentDocumentId, documentName, refreshDocuments, refreshVersions, savedDocuments],
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
      setCurrentDocumentId(documentId);
      setDocumentName(name);
      setLibraryError(null);
      await refreshDocuments();
      await refreshVersions(documentId);

      return {
        id: documentId,
        name,
        buffer,
      };
    },
    [api, refreshDocuments, refreshVersions, savedDocuments],
  );

  const renameSavedDocument = useCallback(
    async (documentId: string, name: string) => {
      try {
        const renamedDocument = await api.renameDocument(documentId, name);
        if (documentId === currentDocumentId) {
          setDocumentName(renamedDocument.name);
        }
        setLibraryError(null);
        await refreshDocuments();
        return renamedDocument;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to rename document.';
        setLibraryError(message);
        throw error;
      }
    },
    [api, currentDocumentId, refreshDocuments],
  );

  const deleteSavedDocument = useCallback(
    async (documentId: string) => {
      try {
        await api.deleteDocument(documentId);
        if (documentId === currentDocumentId) {
          setCurrentDocumentId(null);
          setCurrentDocumentVersions([]);
        }
        setLibraryError(null);
        await refreshDocuments();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete document.';
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
