import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

import type {
  CreateDocumentStoreOptions,
  DocumentStorePort,
  ReadDocumentOptions,
  RenameDocumentInput,
  SaveDocumentInput,
  SavedDocumentRecord,
  SavedDocumentSummary,
  SavedDocumentVersionRecord,
  SavedDocumentVersionSummary,
  UpdateDocumentInput,
} from './types.ts';

const INDEX_FILENAME = 'index.json';
const FILE_EXTENSION = '.docx';
const DEFAULT_MAX_VERSIONS_PER_DOCUMENT = 100;

type StoredDocumentSummary = Omit<SavedDocumentSummary, 'revision'> & {
  latestVersionId: string;
  revision: number;
};

export class DocumentConflictError extends Error {
  constructor() {
    super('Document was changed by another client. Reload before saving again.');
    this.name = 'DocumentConflictError';
  }
}

export class DocumentNotFoundError extends Error {
  constructor(message = 'Document not found.') {
    super(message);
    this.name = 'DocumentNotFoundError';
  }
}

type DocumentIndex = {
  documents: StoredDocumentSummary[];
  versions: SavedDocumentVersionSummary[];
};

function ensureDocxName(name: string | undefined) {
  const trimmed = `${name ?? ''}`.trim();
  if (!trimmed) {
    return `Untitled${FILE_EXTENSION}`;
  }

  return trimmed.toLowerCase().endsWith(FILE_EXTENSION) ? trimmed : `${trimmed}${FILE_EXTENSION}`;
}

function createTimestamp() {
  return new Date().toISOString();
}

function byUpdatedAtDescending(left: SavedDocumentSummary, right: SavedDocumentSummary) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function byCreatedAtDescending(
  left: SavedDocumentVersionSummary,
  right: SavedDocumentVersionSummary,
) {
  return right.createdAt.localeCompare(left.createdAt);
}

function createDuplicateName(name: string) {
  const trimmed = name.trim();
  const extension = FILE_EXTENSION;

  if (trimmed.toLowerCase().endsWith(extension)) {
    return `${trimmed.slice(0, -extension.length)} Copy${extension}`;
  }

  return `${trimmed} Copy${extension}`;
}

export class FileDocumentStore implements DocumentStorePort {
  readonly dataDir: string;

  readonly indexPath: string;

  private writeQueue: Promise<void> = Promise.resolve();

  private readonly maxVersionsPerDocument: number;

  constructor({
    dataDir,
    maxVersionsPerDocument = DEFAULT_MAX_VERSIONS_PER_DOCUMENT,
  }: {
    dataDir: string;
    maxVersionsPerDocument?: number;
  }) {
    this.dataDir = dataDir;
    this.maxVersionsPerDocument = maxVersionsPerDocument;
    this.indexPath = join(dataDir, INDEX_FILENAME);
  }


  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async verifyIntegrity() {
    const index = await this.readIndex();
    const documentIds = new Set(index.documents.map((document) => document.id));
    const versionIds = new Set(index.versions.map((version) => `${version.documentId}:${version.id}`));

    for (const document of index.documents) {
      if (!document.latestVersionId || !versionIds.has(`${document.id}:${document.latestVersionId}`)) {
        throw new Error(`Document ${document.id} has no valid latest version.`);
      }
      const versions = index.versions.filter((version) => version.documentId === document.id);
      for (const version of versions) {
        await stat(this.documentVersionPath(document.id, version.id));
      }
    }

    for (const entry of await readdir(this.dataDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !documentIds.has(entry.name)) {
        throw new Error(`Orphan document directory found: ${entry.name}.`);
      }
    }
  }
  async listDocuments() {
    const index = await this.readIndex();
    return index.documents.map(this.toPublicDocumentSummary).sort(byUpdatedAtDescending);
  }

  async listDocumentVersions(documentId: string) {
    const index = await this.readIndex();
    this.getStoredDocumentOrThrow(index, documentId);
    return index.versions.filter((version) => version.documentId === documentId).sort(byCreatedAtDescending);
  }

  async saveNewDocument({ name, buffer }: SaveDocumentInput) {
    return this.runExclusive(async () => {
      const index = await this.readIndex();
      const documentId = randomUUID();
      const versionId = randomUUID();
      const timestamp = createTimestamp();
      const documentName = ensureDocxName(name);
      const version = this.createVersionSummary({
        documentId,
        versionId,
        name: documentName,
        timestamp,
        buffer,
      });
      const document = this.createStoredDocumentSummary({
        documentId,
        latestVersionId: versionId,
        name: documentName,
        createdAt: timestamp,
        updatedAt: timestamp,
        sizeInBytes: buffer.byteLength,
        lastOpenedAt: null,
        versionCount: 1,
        revision: 1,
      });

      index.documents.push(document);
      index.versions.push(version);
      await this.writeDocumentFile(documentId, versionId, buffer);
      await this.pruneVersions(index, documentId);
      await this.writeIndex(index);
      return this.toPublicDocumentSummary(document);
    });
  }

  async updateDocument(id: string, { name, buffer, expectedRevision }: UpdateDocumentInput) {
    return this.runExclusive(async () => {
      const index = await this.readIndex();
      const existingDocument = this.getStoredDocumentOrThrow(index, id);
      if (expectedRevision !== undefined && existingDocument.revision !== expectedRevision) {
        throw new DocumentConflictError();
      }
      const timestamp = createTimestamp();
      const versionId = randomUUID();
      const documentName = ensureDocxName(name ?? existingDocument.name);
      const version = this.createVersionSummary({
        documentId: id,
        versionId,
        name: documentName,
        timestamp,
        buffer,
      });
      const updatedDocument: StoredDocumentSummary = {
        ...existingDocument,
        latestVersionId: versionId,
        name: documentName,
        updatedAt: timestamp,
        sizeInBytes: buffer.byteLength,
        versionCount: existingDocument.versionCount + 1,
        revision: existingDocument.revision + 1,
      };

      index.documents = index.documents.map((document) => (document.id === id ? updatedDocument : document));
      index.versions.push(version);
      await this.writeDocumentFile(id, versionId, buffer);
      await this.pruneVersions(index, id);
      await this.writeIndex(index);
      return this.toPublicDocumentSummary(updatedDocument);
    });
  }

  async renameDocument(id: string, { name }: RenameDocumentInput) {
    return this.runExclusive(async () => {
      const index = await this.readIndex();
      const existingDocument = this.getStoredDocumentOrThrow(index, id);
      const renamedDocument: StoredDocumentSummary = {
        ...existingDocument,
        name: ensureDocxName(name ?? existingDocument.name),
        updatedAt: createTimestamp(),
      };

      index.documents = index.documents.map((document) =>
        document.id === id ? renamedDocument : document,
      );
      await this.writeIndex(index);
      return this.toPublicDocumentSummary(renamedDocument);
    });
  }

  async deleteDocument(id: string) {
    return this.runExclusive(async () => {
      const index = await this.readIndex();
      this.getStoredDocumentOrThrow(index, id);

      index.documents = index.documents.filter((document) => document.id !== id);
      index.versions = index.versions.filter((version) => version.documentId !== id);
      await this.writeIndex(index);
      await rm(this.documentDirectoryPath(id), { recursive: true, force: true });
    });
  }

  async duplicateDocument(id: string) {
    return this.runExclusive(async () => {
      const index = await this.readIndex();
      const existingDocument = this.getStoredDocumentOrThrow(index, id);
      const latestVersion = this.getVersionOrThrow(index, id, existingDocument.latestVersionId);
      const buffer = await this.readVersionBuffer(id, latestVersion.id);

      const documentId = randomUUID();
      const versionId = randomUUID();
      const timestamp = createTimestamp();
      const documentName = createDuplicateName(existingDocument.name);

      const version = this.createVersionSummary({
        documentId,
        versionId,
        name: documentName,
        timestamp,
        buffer,
      });

      const document = this.createStoredDocumentSummary({
        documentId,
        latestVersionId: versionId,
        name: documentName,
        createdAt: timestamp,
        updatedAt: timestamp,
        sizeInBytes: buffer.byteLength,
        lastOpenedAt: null,
        versionCount: 1,
        revision: 1,
      });

      index.documents.push(document);
      index.versions.push(version);
      await this.writeDocumentFile(documentId, versionId, buffer);
      await this.writeIndex(index);
      return this.toPublicDocumentSummary(document);
    });
  }

  async readDocument(id: string, options?: ReadDocumentOptions) {
    const record = await this.readDocumentRecord(id, options);
    return record.buffer;
  }

  async readDocumentRecord(id: string, options?: ReadDocumentOptions): Promise<SavedDocumentRecord> {
    if (options?.markOpened) {
      return this.runExclusive(() => this.readDocumentRecordFromIndex(id, true));
    }

    return this.readDocumentRecordFromIndex(id, false);
  }

  private async readDocumentRecordFromIndex(id: string, markOpened: boolean) {
    const index = await this.readIndex();
    const document = this.getStoredDocumentOrThrow(index, id);
    const latestVersion = this.getVersionOrThrow(index, id, document.latestVersionId);
    return {
      metadata: markOpened
        ? await this.touchDocumentOpened(index, document)
        : this.toPublicDocumentSummary(document),
      buffer: await this.readVersionBuffer(id, latestVersion.id),
    };
  }

  async readDocumentVersionRecord(
    documentId: string,
    versionId: string,
  ): Promise<SavedDocumentVersionRecord> {
    const index = await this.readIndex();
    const version = this.getVersionOrThrow(index, documentId, versionId);
    return {
      metadata: version,
      buffer: await this.readVersionBuffer(documentId, versionId),
    };
  }

  private createStoredDocumentSummary({
    documentId,
    latestVersionId,
    name,
    createdAt,
    updatedAt,
    sizeInBytes,
    lastOpenedAt,
    versionCount,
    revision,
  }: {
    documentId: string;
    latestVersionId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    sizeInBytes: number;
    lastOpenedAt: string | null;
    versionCount: number;
    revision: number;
  }): StoredDocumentSummary {
    return {
      id: documentId,
      latestVersionId,
      name,
      createdAt,
      updatedAt,
      sizeInBytes,
      lastOpenedAt,
      versionCount,
      revision,
    };
  }

  private createVersionSummary({
    documentId,
    versionId,
    name,
    timestamp,
    buffer,
  }: {
    documentId: string;
    versionId: string;
    name: string;
    timestamp: string;
    buffer: Uint8Array;
  }): SavedDocumentVersionSummary {
    return {
      id: versionId,
      documentId,
      name,
      createdAt: timestamp,
      sizeInBytes: buffer.byteLength,
    };
  }

  private toPublicDocumentSummary(document: StoredDocumentSummary): SavedDocumentSummary {
    return {
      id: document.id,
      name: document.name,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      sizeInBytes: document.sizeInBytes,
      lastOpenedAt: document.lastOpenedAt,
      versionCount: document.versionCount,
      revision: document.revision,
    };
  }

  private async touchDocumentOpened(index: DocumentIndex, document: StoredDocumentSummary) {
    const touchedDocument: StoredDocumentSummary = {
      ...document,
      lastOpenedAt: createTimestamp(),
    };
    index.documents = index.documents.map((entry) =>
      entry.id === document.id ? touchedDocument : entry,
    );
    await this.writeIndex(index);
    return this.toPublicDocumentSummary(touchedDocument);
  }

  /**
   * Prunes stale versions after `writeIndex` has already committed the
   * retained set. Removing files only once the index no longer references
   * them keeps a crash mid-prune from leaving dangling index entries; the
   * leftover files become harmless orphans instead.
   */
  private async pruneVersions(index: DocumentIndex, documentId: string) {
    const versions = index.versions
      .filter((version) => version.documentId === documentId)
      .sort(byCreatedAtDescending);
    const retained = new Set(versions.slice(0, this.maxVersionsPerDocument).map((version) => version.id));
    const removed = versions.filter((version) => !retained.has(version.id));
    if (removed.length === 0) return;

    index.versions = index.versions.filter(
      (version) => version.documentId !== documentId || retained.has(version.id),
    );
    index.documents = index.documents.map((document) =>
      document.id === documentId
        ? { ...document, versionCount: retained.size }
        : document,
    );

    await this.writeIndex(index);
    for (const version of removed) {
      await rm(this.documentVersionPath(documentId, version.id), { force: true });
    }
  }

  private getStoredDocumentOrThrow(index: DocumentIndex, documentId: string) {
    const document = index.documents.find((entry) => entry.id === documentId);
    if (!document) {
      throw new DocumentNotFoundError(`Document ${documentId} was not found.`);
    }

    return document;
  }

  private getVersionOrThrow(index: DocumentIndex, documentId: string, versionId: string) {
    const version = index.versions.find(
      (entry) => entry.documentId === documentId && entry.id === versionId,
    );
    if (!version) {
      throw new DocumentNotFoundError(`Version ${versionId} for document ${documentId} was not found.`);
    }

    return version;
  }

  private async readVersionBuffer(documentId: string, versionId: string) {
    try {
      return await readFile(this.documentVersionPath(documentId, versionId));
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new DocumentNotFoundError(`Version ${versionId} for document ${documentId} was not found.`);
      }

      throw error;
    }
  }

  private async readIndex(): Promise<DocumentIndex> {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const rawIndex = await readFile(this.indexPath, 'utf-8');
      const parsedIndex = JSON.parse(rawIndex) as Partial<DocumentIndex>;
      const versions = Array.isArray(parsedIndex.versions) ? parsedIndex.versions : [];

      return {
        documents: Array.isArray(parsedIndex.documents)
          ? parsedIndex.documents.map((document) => {
            const partialDocument = document as Partial<StoredDocumentSummary>;
            const documentVersions = versions
              .filter((version) => version.documentId === partialDocument.id)
              .sort(byCreatedAtDescending);

            return {
              ...partialDocument,
              latestVersionId:
                partialDocument.latestVersionId ?? documentVersions[0]?.id ?? '',
              lastOpenedAt: partialDocument.lastOpenedAt ?? null,
              versionCount: partialDocument.versionCount ?? documentVersions.length,
              revision: partialDocument.revision ?? partialDocument.versionCount ?? documentVersions.length,
            } as StoredDocumentSummary;
          })
          : [],
        versions,
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { documents: [], versions: [] };
      }

      throw error;
    }
  }

  private async writeIndex(index: DocumentIndex) {
    await mkdir(dirname(this.indexPath), { recursive: true });
    const tmpPath = `${this.indexPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(index, null, 2));
    await rename(tmpPath, this.indexPath);
  }

  private async writeDocumentFile(documentId: string, versionId: string, buffer: Uint8Array) {
    await mkdir(this.documentDirectoryPath(documentId), { recursive: true });
    await writeFile(this.documentVersionPath(documentId, versionId), buffer);
  }

  private documentDirectoryPath(documentId: string) {
    return join(this.dataDir, documentId);
  }

  private documentVersionPath(documentId: string, versionId: string) {
    return join(this.documentDirectoryPath(documentId), `${versionId}${FILE_EXTENSION}`);
  }
}

export function createDocumentStore(options?: CreateDocumentStoreOptions) {
  const dataDir = options?.dataDir ?? options?.rootDirectory;
  if (!dataDir?.trim()) {
    throw new Error('Document storage directory is required.');
  }

  return new FileDocumentStore({
    dataDir,
    maxVersionsPerDocument: options?.maxVersionsPerDocument,
  });
}
