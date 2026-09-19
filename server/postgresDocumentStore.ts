import { randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from './generated/prisma/client.ts';
import {
  documentPrefix,
  documentVersionKey,
  type BlobStoragePort,
} from './blobStorage.ts';
import { DocumentConflictError, DocumentNotFoundError } from './documentStore.ts';
import { createDuplicateName, ensureDocxName } from './documentNaming.ts';
import type {
  DocumentStorePort,
  ReadDocumentOptions,
  RenameDocumentInput,
  SaveDocumentInput,
  SavedDocumentSummary,
  SavedDocumentVersionRecord,
  SavedDocumentVersionSummary,
  UpdateDocumentInput,
} from './types.ts';

const DEFAULT_MAX_VERSIONS_PER_DOCUMENT = 100;

/** Either the root client or an interactive-transaction client. */
type Database = PrismaClient | Prisma.TransactionClient;

type DocumentRow = {
  id: string;
  name: string;
  sizeInBytes: bigint;
  lastOpenedAt: Date | null;
  versionCount: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type VersionRow = {
  id: string;
  documentId: string;
  name: string;
  sizeInBytes: bigint;
  createdAt: Date;
  storageKey: string;
};

function toDocumentSummary(row: DocumentRow): SavedDocumentSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sizeInBytes: Number(row.sizeInBytes),
    lastOpenedAt: row.lastOpenedAt ? row.lastOpenedAt.toISOString() : null,
    versionCount: row.versionCount,
    revision: row.revision,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function toVersionSummary(row: VersionRow): SavedDocumentVersionSummary {
  return {
    id: row.id,
    documentId: row.documentId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    sizeInBytes: Number(row.sizeInBytes),
  };
}

/**
 * Prisma-backed document store: metadata in Postgres, .docx bytes in blob
 * storage. Mirrors `FileDocumentStore`'s behaviour so the two are
 * interchangeable behind `DocumentStorePort` (see the shared contract test).
 */
export class PostgresDocumentStore implements DocumentStorePort {
  private readonly prisma: PrismaClient;

  private readonly blobs: BlobStoragePort;

  private readonly maxVersionsPerDocument: number;

  private readonly ownerId: string | null;

  constructor({
    prisma,
    blobs,
    maxVersionsPerDocument = DEFAULT_MAX_VERSIONS_PER_DOCUMENT,
    ownerId = null,
  }: {
    prisma: PrismaClient;
    blobs: BlobStoragePort;
    maxVersionsPerDocument?: number;
    ownerId?: string | null;
  }) {
    this.prisma = prisma;
    this.blobs = blobs;
    this.maxVersionsPerDocument = maxVersionsPerDocument;
    this.ownerId = ownerId;
  }

  forOwner(ownerId: string): DocumentStorePort {
    return new PostgresDocumentStore({
      prisma: this.prisma,
      blobs: this.blobs,
      maxVersionsPerDocument: this.maxVersionsPerDocument,
      ownerId,
    });
  }

  /** Owner filter applied to every query; `undefined` means "no scoping". */
  private get ownerFilter() {
    return this.ownerId ? { ownerId: this.ownerId } : {};
  }

  async listDocuments() {
    const rows = await this.prisma.document.findMany({
      where: { deletedAt: null, ...this.ownerFilter },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toDocumentSummary);
  }

  async listDeletedDocuments() {
    const rows = await this.prisma.document.findMany({
      where: { deletedAt: { not: null }, ...this.ownerFilter },
      orderBy: { deletedAt: 'desc' },
    });
    return rows.map(toDocumentSummary);
  }

  async listDocumentVersions(documentId: string) {
    await this.requireDocument(this.prisma, documentId);
    const rows = await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toVersionSummary);
  }

  async saveNewDocument({ name, buffer }: SaveDocumentInput) {
    const documentId = randomUUID();
    const versionId = randomUUID();
    const documentName = ensureDocxName(name);
    const storageKey = documentVersionKey(documentId, versionId);
    const timestamp = new Date();

    await this.blobs.put(storageKey, buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.document.create({
          data: {
            id: documentId,
            ownerId: this.ownerId,
            name: documentName,
            sizeInBytes: BigInt(buffer.byteLength),
            versionCount: 1,
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        await tx.documentVersion.create({
          data: {
            id: versionId,
            documentId,
            storageKey,
            name: documentName,
            sizeInBytes: BigInt(buffer.byteLength),
            createdAt: timestamp,
          },
        });
        const created = await tx.document.update({
          where: { id: documentId },
          data: { latestVersionId: versionId },
        });
        return toDocumentSummary(created);
      });
    } catch (error) {
      await this.blobs.delete(storageKey);
      throw error;
    }
  }

  async updateDocument(id: string, { name, buffer, expectedRevision }: UpdateDocumentInput) {
    const versionId = randomUUID();
    const storageKey = documentVersionKey(id, versionId);
    const timestamp = new Date();

    await this.blobs.put(storageKey, buffer);
    try {
      const { summary, removedKeys } = await this.prisma.$transaction(async (tx) => {
        const current = await this.requireDocument(tx, id);
        if (expectedRevision !== undefined && current.revision !== expectedRevision) {
          throw new DocumentConflictError();
        }

        const documentName = ensureDocxName(name ?? current.name);
        await tx.documentVersion.create({
          data: {
            id: versionId,
            documentId: id,
            storageKey,
            name: documentName,
            sizeInBytes: BigInt(buffer.byteLength),
            createdAt: timestamp,
          },
        });

        // Optimistic guard: only the writer holding `current.revision` wins.
        const updated = await tx.document.updateMany({
          where: { id, revision: current.revision },
          data: {
            latestVersionId: versionId,
            name: documentName,
            sizeInBytes: BigInt(buffer.byteLength),
            versionCount: { increment: 1 },
            revision: { increment: 1 },
            updatedAt: timestamp,
          },
        });
        if (updated.count !== 1) {
          throw new DocumentConflictError();
        }

        const row = await this.requireDocument(tx, id);
        return { summary: toDocumentSummary(row), removedKeys: await this.pruneVersions(tx, id) };
      });

      await this.deleteBlobs(removedKeys);
      return summary;
    } catch (error) {
      await this.blobs.delete(storageKey);
      throw error;
    }
  }

  async renameDocument(id: string, { name, onPreviousName }: RenameDocumentInput) {
    const current = await this.requireDocument(this.prisma, id);
    const renamed = await this.prisma.document.update({
      where: { id },
      data: { name: ensureDocxName(name ?? current.name), updatedAt: new Date() },
    });
    onPreviousName?.(current.name);
    return toDocumentSummary(renamed);
  }

  async deleteDocument(id: string) {
    await this.requireDocument(this.prisma, id);
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreDocument(id: string) {
    await this.requireDeletedDocument(id);
    const restored = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: null },
    });
    return toDocumentSummary(restored);
  }

  async purgeDocument(id: string) {
    await this.requireDeletedDocument(id);
    await this.prisma.document.delete({ where: { id } });
    await this.blobs.deletePrefix(documentPrefix(id));
  }

  async purgeExpiredDocuments(deletedBefore: Date) {
    const expired = await this.prisma.document.findMany({
      where: { deletedAt: { not: null, lt: deletedBefore }, ...this.ownerFilter },
      select: { id: true },
    });
    if (expired.length === 0) return 0;

    const expiredIds = expired.map((document) => document.id);
    await this.prisma.document.deleteMany({
      where: { id: { in: expiredIds }, ...this.ownerFilter },
    });
    for (const expiredId of expiredIds) {
      await this.blobs.deletePrefix(documentPrefix(expiredId));
    }
    return expiredIds.length;
  }

  async duplicateDocument(id: string) {
    const record = await this.readDocumentRecord(id);
    return this.saveNewDocument({
      name: createDuplicateName(record.metadata.name),
      buffer: record.buffer,
    });
  }

  async readDocument(id: string, options?: ReadDocumentOptions) {
    const record = await this.readDocumentRecord(id, options);
    return record.buffer;
  }

  async readDocumentRecord(id: string, options?: ReadDocumentOptions) {
    const document = await this.requireDocument(this.prisma, id);
    const version = await this.requireLatestVersion(document);
    const buffer = await this.blobs.get(version.storageKey);

    if (!options?.markOpened) {
      return { metadata: toDocumentSummary(document), buffer };
    }

    const touched = await this.prisma.document.update({
      where: { id },
      data: { lastOpenedAt: new Date() },
    });
    return { metadata: toDocumentSummary(touched), buffer };
  }

  async readDocumentVersionRecord(
    documentId: string,
    versionId: string,
  ): Promise<SavedDocumentVersionRecord> {
    await this.requireDocument(this.prisma, documentId);
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId },
    });
    if (!version) {
      throw new DocumentNotFoundError(
        `Version ${versionId} for document ${documentId} was not found.`,
      );
    }

    return {
      metadata: toVersionSummary(version),
      buffer: await this.blobs.get(version.storageKey),
    };
  }

  async verifyIntegrity() {
    const documents = await this.prisma.document.findMany({
      where: { deletedAt: null, ...this.ownerFilter },
      select: { id: true, latestVersionId: true },
    });

    for (const document of documents) {
      const latest = document.latestVersionId
        ? await this.prisma.documentVersion.findFirst({
            where: { id: document.latestVersionId, documentId: document.id },
          })
        : null;
      if (!latest) {
        throw new Error(`Document ${document.id} has no valid latest version.`);
      }

      const versions = await this.prisma.documentVersion.findMany({
        where: { documentId: document.id },
        select: { storageKey: true },
      });
      for (const version of versions) {
        if (!(await this.blobs.exists(version.storageKey))) {
          throw new Error(`Document ${document.id} is missing a stored version.`);
        }
      }
    }
  }

  /** Deletes versions beyond the retention limit and returns their blob keys. */
  private async pruneVersions(tx: Prisma.TransactionClient, documentId: string) {
    const versions = await tx.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, storageKey: true },
    });
    const removed = versions.slice(this.maxVersionsPerDocument);

    if (removed.length > 0) {
      await tx.documentVersion.deleteMany({ where: { id: { in: removed.map((row) => row.id) } } });
    }
    await tx.document.update({
      where: { id: documentId },
      data: { versionCount: versions.length - removed.length },
    });

    return removed.map((row) => row.storageKey);
  }

  private async deleteBlobs(keys: string[]) {
    for (const key of keys) {
      await this.blobs.delete(key);
    }
  }

  private async requireDocument(db: Database, id: string) {
    const document = await db.document.findFirst({
      where: { id, deletedAt: null, ...this.ownerFilter },
    });
    if (!document) {
      throw new DocumentNotFoundError(`Document ${id} was not found.`);
    }
    return document;
  }

  private async requireDeletedDocument(id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: { not: null }, ...this.ownerFilter },
    });
    if (!document) {
      throw new DocumentNotFoundError(`Document ${id} was not found.`);
    }
    return document;
  }

  private async requireLatestVersion(document: { id: string; latestVersionId: string | null }) {
    const version = document.latestVersionId
      ? await this.prisma.documentVersion.findFirst({
          where: { id: document.latestVersionId, documentId: document.id },
        })
      : null;
    if (!version) {
      throw new DocumentNotFoundError(`Document ${document.id} has no valid latest version.`);
    }
    return version;
  }
}
