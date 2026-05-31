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

type UseDocumentLibraryOptions = {
  initialDocumentName: string;
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


export function useDocumentLibrary({ initialDocumentName }: UseDocumentLibraryOptions) {
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
      const documents = await listDocuments();
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
  }, []);

  const refreshVersions = useCallback(async (documentId = currentDocumentId) => {
    if (!documentId) {
      setCurrentDocumentVersions([]);
      setVersionError(null);
      return [];
    }

    setIsLoadingVersions(true);

    try {
      const versions = await listDocumentVersions(documentId);
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
  }, [currentDocumentId]);

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
        const saveInput = {
          name,
          buffer,
          ...(options?.asNew || !currentDocumentId ? {} : { id: currentDocumentId }),
        };
        const savedDocument = await saveDocument(saveInput);

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
    [currentDocumentId, documentName, refreshDocuments, refreshVersions],
  );

  const openSavedDocument = useCallback(
    async (documentId: string): Promise<OpenedDocument> => {
      const buffer = await readDocumentContent(documentId, { markOpened: true });
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
    [refreshDocuments, refreshVersions, savedDocuments],
  );

  const renameSavedDocument = useCallback(
    async (documentId: string, name: string) => {
      try {
        const renamedDocument = await renameDocument(documentId, name);
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
    [currentDocumentId, refreshDocuments],
  );

  const deleteSavedDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument(documentId);
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
    [currentDocumentId, refreshDocuments],
  );

  const duplicateSavedDocument = useCallback(
    async (documentId: string) => {
      const duplicatedDocument = await duplicateDocument(documentId);
      await refreshDocuments();
      return duplicatedDocument;
    },
    [refreshDocuments],
  );

  const restoreDocumentVersion = useCallback(
    async (documentId: string, versionId: string) => {
      const buffer = await readDocumentVersionContent(documentId, versionId);
      const matchingDocument =
        savedDocuments.find((document) => document.id === documentId) ??
        (await refreshDocuments()).find((document) => document.id === documentId) ??
        null;

      const restoredDocument = await saveDocument({
        id: documentId,
        name: matchingDocument?.name ?? documentName,
        buffer,
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
    [currentDocumentId, documentName, refreshDocuments, refreshVersions, savedDocuments],
  );

  const readSavedDocumentBuffer = useCallback((documentId: string) => {
    return readDocumentContent(documentId, { markOpened: false });
  }, []);

  const readVersionBuffer = useCallback((documentId: string, versionId: string) => {
    return readDocumentVersionContent(documentId, versionId);
  }, []);

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
