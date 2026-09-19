import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DocumentConflictError, DocumentNotFoundError } from '../../documentStore.ts';
import type { DocumentStorePort } from '../../types.ts';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

function bytes(values: number[]) {
  return Uint8Array.from(values);
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

export type StoreHarness = {
  createStore(options?: { maxVersionsPerDocument?: number }): Promise<DocumentStorePort>;
  /** Returns the store to an empty state between tests. */
  reset(): Promise<void>;
  dispose(): Promise<void>;
};

/**
 * The behavioural contract every `DocumentStorePort` implementation must satisfy.
 * Running the same suite against the file store and the Postgres store is what
 * proves they are interchangeable.
 */
export function describeDocumentStoreContract(name: string, setup: () => Promise<StoreHarness>) {
  describe(`${name} — document store contract`, () => {
    let harness: StoreHarness;

    beforeAll(async () => {
      harness = await setup();
    });

    afterAll(async () => {
      await harness.dispose();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    it('saves a document with an initial version and normalizes the name', async () => {
      const store = await harness.createStore();

      const created = await store.saveNewDocument({ name: 'Report', buffer: bytes([1, 2, 3]) });

      expect(created).toMatchObject({
        name: 'Report.docx',
        versionCount: 1,
        revision: 1,
        sizeInBytes: 3,
        lastOpenedAt: null,
      });

      const versions = await store.listDocumentVersions(created.id);
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ documentId: created.id, name: 'Report.docx', sizeInBytes: 3 });

      expect((await store.listDocuments()).map((document) => document.id)).toEqual([created.id]);
    });

    it('falls back to a placeholder name for an empty name', async () => {
      const store = await harness.createStore();

      const created = await store.saveNewDocument({ name: '  ', buffer: bytes([1]) });

      expect(created.name).toBe('Untitled.docx');
    });

    it('adds a version and bumps the revision on update', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Doc', buffer: bytes([1]) });

      const updated = await store.updateDocument(created.id, { buffer: bytes([2, 2]) });

      expect(updated.revision).toBe(2);
      expect(updated.versionCount).toBe(2);
      expect(updated.sizeInBytes).toBe(2);
      const versions = await store.listDocumentVersions(created.id);
      expect(versions).toHaveLength(2);
      expect(Array.from(await store.readDocument(created.id))).toEqual([2, 2]);
    });

    it('rejects a save when the expected revision is stale', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Conflict', buffer: bytes([1]) });
      await store.updateDocument(created.id, { buffer: bytes([2]), expectedRevision: created.revision });

      await expect(
        store.updateDocument(created.id, { buffer: bytes([3]), expectedRevision: created.revision }),
      ).rejects.toBeInstanceOf(DocumentConflictError);
    });

    it('records last-opened time when reading with markOpened', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Opened', buffer: bytes([1]) });
      expect(created.lastOpenedAt).toBeNull();

      const record = await store.readDocumentRecord(created.id, { markOpened: true });

      expect(record.metadata.lastOpenedAt).not.toBeNull();
      expect((await store.listDocuments())[0]?.lastOpenedAt).not.toBeNull();
    });

    it('renames a document without changing its revision', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Doc', buffer: bytes([1]) });

      const renamed = await store.renameDocument(created.id, { name: 'Renamed' });

      expect(renamed.name).toBe('Renamed.docx');
      expect(renamed.revision).toBe(created.revision);
    });

    it('duplicates a document with the latest content and a Copy name', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Original.docx', buffer: bytes([9]) });

      const copy = await store.duplicateDocument(created.id);

      expect(copy.id).not.toBe(created.id);
      expect(copy.name).toBe('Original Copy.docx');
      expect(copy.versionCount).toBe(1);
      expect(Array.from(await store.readDocument(copy.id))).toEqual([9]);
      expect(await store.listDocuments()).toHaveLength(2);
    });

    it('deletes a document together with its versions', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Doomed', buffer: bytes([1]) });

      await store.deleteDocument(created.id);

      expect(await store.listDocuments()).toHaveLength(0);
      await expect(store.listDocumentVersions(created.id)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      await expect(store.readDocument(created.id)).rejects.toBeInstanceOf(DocumentNotFoundError);
    });

    it('moves a deleted document to trash and hides its reads', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Trashed', buffer: bytes([1]) });
      const [version] = await store.listDocumentVersions(created.id);

      await store.deleteDocument(created.id);

      expect(await store.listDocuments()).toHaveLength(0);
      expect((await store.listDeletedDocuments()).map((document) => document.id)).toEqual([
        created.id,
      ]);
      await expect(store.readDocument(created.id)).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(store.readDocumentRecord(created.id)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      await expect(store.listDocumentVersions(created.id)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      await expect(
        store.readDocumentVersionRecord(created.id, version!.id),
      ).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(
        store.updateDocument(created.id, { buffer: bytes([2]) }),
      ).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(
        store.renameDocument(created.id, { name: 'Nope' }),
      ).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(store.duplicateDocument(created.id)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      await expect(store.restoreDocument(MISSING_ID)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
    });

    it('lists trashed documents most recently deleted first', async () => {
      const store = await harness.createStore();
      const first = await store.saveNewDocument({ name: 'First', buffer: bytes([1]) });
      const second = await store.saveNewDocument({ name: 'Second', buffer: bytes([2]) });

      await store.deleteDocument(first.id);
      await tick();
      await store.deleteDocument(second.id);

      expect((await store.listDeletedDocuments()).map((document) => document.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it('restores a soft-deleted document with its versions intact', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Restore Me', buffer: bytes([1]) });
      const updated = await store.updateDocument(created.id, { buffer: bytes([2]) });
      await store.deleteDocument(created.id);
      expect(await store.listDeletedDocuments()).toHaveLength(1);

      const restored = await store.restoreDocument(created.id);

      expect(restored).toMatchObject({
        id: created.id,
        name: 'Restore Me.docx',
        revision: updated.revision,
        versionCount: 2,
      });
      expect((await store.listDocuments()).map((document) => document.id)).toEqual([created.id]);
      expect(await store.listDeletedDocuments()).toHaveLength(0);
      expect(await store.listDocumentVersions(created.id)).toHaveLength(2);
      expect(Array.from(await store.readDocument(created.id))).toEqual([2]);
    });

    it('purges a soft-deleted document permanently', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Purge Me', buffer: bytes([1]) });
      await store.deleteDocument(created.id);

      await store.purgeDocument(created.id);

      expect(await store.listDocuments()).toHaveLength(0);
      expect(await store.listDeletedDocuments()).toHaveLength(0);
      await expect(store.readDocument(created.id)).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(store.restoreDocument(created.id)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      await expect(store.purgeDocument(created.id)).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(store.verifyIntegrity()).resolves.toBeUndefined();
    });

    it('refuses to purge a live document', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Alive', buffer: bytes([1]) });

      await expect(store.purgeDocument(created.id)).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(store.restoreDocument(created.id)).rejects.toBeInstanceOf(DocumentNotFoundError);

      expect((await store.listDocuments()).map((document) => document.id)).toEqual([created.id]);
      expect(await store.listDeletedDocuments()).toHaveLength(0);
      expect(Array.from(await store.readDocument(created.id))).toEqual([1]);
    });

    it('throws for a missing document', async () => {
      const store = await harness.createStore();

      await expect(store.readDocument(MISSING_ID)).rejects.toBeInstanceOf(DocumentNotFoundError);
      await expect(store.listDocumentVersions(MISSING_ID)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      await expect(store.deleteDocument(MISSING_ID)).rejects.toBeInstanceOf(DocumentNotFoundError);
    });

    it('retains a bounded version history', async () => {
      const store = await harness.createStore({ maxVersionsPerDocument: 3 });
      const created = await store.saveNewDocument({ name: 'Bounded', buffer: bytes([1]) });
      for (let index = 0; index < 4; index += 1) {
        await store.updateDocument(created.id, { buffer: bytes([index + 2]) });
      }

      expect(await store.listDocumentVersions(created.id)).toHaveLength(3);
      expect((await store.listDocuments())[0]?.versionCount).toBe(3);
    });

    it('passes integrity verification', async () => {
      const store = await harness.createStore();
      const created = await store.saveNewDocument({ name: 'Healthy', buffer: bytes([1]) });
      await store.updateDocument(created.id, { buffer: bytes([2]) });

      await expect(store.verifyIntegrity()).resolves.toBeUndefined();
    });
  });
}
