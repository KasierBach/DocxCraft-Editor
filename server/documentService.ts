import type {
  DocumentStorePort,
  ReadDocumentOptions,
  RenameDocumentInput,
  SaveDocumentInput,
  UpdateDocumentInput,
} from './types.ts';

export class DocumentService {
  private readonly store: DocumentStorePort;

  constructor(store: DocumentStorePort) {
    this.store = store;
  }

  listDocuments() {
    return this.store.listDocuments();
  }

  listDocumentVersions(documentId: string) {
    return this.store.listDocumentVersions(documentId);
  }

  createDocument(input: SaveDocumentInput) {
    return this.store.saveNewDocument(input);
  }

  updateDocument(id: string, input: UpdateDocumentInput) {
    return this.store.updateDocument(id, input);
  }

  renameDocument(id: string, input: RenameDocumentInput) {
    return this.store.renameDocument(id, input);
  }

  deleteDocument(id: string) {
    return this.store.deleteDocument(id);
  }

  duplicateDocument(id: string) {
    return this.store.duplicateDocument(id);
  }

  readDocumentContent(id: string, options?: ReadDocumentOptions) {
    return this.store.readDocumentRecord(id, options);
  }

  readDocumentVersionContent(documentId: string, versionId: string) {
    return this.store.readDocumentVersionRecord(documentId, versionId);
  }
}
