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
  /**
   * Called with the stored name before the rename succeeds. Only the store
   * reads the current row, so this is how the caller learns the previous name.
   */
  onPreviousName?: (previousName: string) => void;
};

export type CreateDocumentStoreOptions = {
  dataDir?: string;
  rootDirectory?: string;
  /** How many versions to retain per document (default 100). */
  maxVersionsPerDocument?: number;
};

export interface DocumentStorePort {
  /** Cheap dependency probe for the readiness endpoint; does not scan blobs. */
  checkReady?(): Promise<void>;
  verifyIntegrity(): Promise<void>;
  /**
   * Returns a view scoped to a single owner. The file store is single-tenant
   * and returns itself; the Postgres store filters and stamps `ownerId`.
   */
  forOwner(ownerId: string): DocumentStorePort;
  /** Read-only account view that also includes documents shared by email. */
  forAccess?(userId: string, email: string): DocumentStorePort;
  /** Account view that includes owned documents and editor shares. */
  forEditor?(userId: string, email: string): DocumentStorePort;
  listDocuments(): Promise<SavedDocumentSummary[]>;
  listDeletedDocuments(): Promise<SavedDocumentSummary[]>;
  listDocumentVersions(documentId: string): Promise<SavedDocumentVersionSummary[]>;
  saveNewDocument(input: SaveDocumentInput): Promise<SavedDocumentSummary>;
  updateDocument(id: string, input: UpdateDocumentInput): Promise<SavedDocumentSummary>;
  renameDocument(id: string, input: RenameDocumentInput): Promise<SavedDocumentSummary>;
  deleteDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<SavedDocumentSummary>;
  purgeDocument(id: string): Promise<void>;
  /** Permanently removes trashed documents deleted before `deletedBefore`; returns the count. */
  purgeExpiredDocuments(deletedBefore: Date): Promise<number>;
  readDocument(id: string, options?: ReadDocumentOptions): Promise<Uint8Array>;
  readDocumentRecord(id: string, options?: ReadDocumentOptions): Promise<SavedDocumentRecord>;
  readDocumentVersionRecord(
    documentId: string,
    versionId: string,
  ): Promise<SavedDocumentVersionRecord>;
  duplicateDocument(id: string): Promise<SavedDocumentSummary>;
}
