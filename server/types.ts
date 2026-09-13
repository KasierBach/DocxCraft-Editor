import type {
  SavedDocumentSummary,
  SavedDocumentVersionSummary,
  SavedDocumentRecord,
  SavedDocumentVersionRecord,
  ReadDocumentOptions,
} from '../shared/types.js';

export type {
  SavedDocumentSummary,
  SavedDocumentVersionSummary,
  SavedDocumentRecord,
  SavedDocumentVersionRecord,
  ReadDocumentOptions,
};

export type SaveDocumentInput = {
  name: string;
  buffer: Uint8Array;
};

export type UpdateDocumentInput = {
  name?: string;
  buffer: Uint8Array;
  expectedRevision?: number;
};

export type RenameDocumentInput = {
  name?: string;
};

export type CreateDocumentStoreOptions = {
  dataDir?: string;
  rootDirectory?: string;
  /** How many versions to retain per document (default 100). */
  maxVersionsPerDocument?: number;
};

export interface DocumentStorePort {
  verifyIntegrity(): Promise<void>;
  listDocuments(): Promise<SavedDocumentSummary[]>;
  listDocumentVersions(documentId: string): Promise<SavedDocumentVersionSummary[]>;
  saveNewDocument(input: SaveDocumentInput): Promise<SavedDocumentSummary>;
  updateDocument(id: string, input: UpdateDocumentInput): Promise<SavedDocumentSummary>;
  renameDocument(id: string, input: RenameDocumentInput): Promise<SavedDocumentSummary>;
  deleteDocument(id: string): Promise<void>;
  readDocument(id: string, options?: ReadDocumentOptions): Promise<Uint8Array>;
  readDocumentRecord(id: string, options?: ReadDocumentOptions): Promise<SavedDocumentRecord>;
  readDocumentVersionRecord(
    documentId: string,
    versionId: string,
  ): Promise<SavedDocumentVersionRecord>;
  duplicateDocument(id: string): Promise<SavedDocumentSummary>;
}
