// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { createDocumentStore } from './documentStore.ts';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'docx-editor-store-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('createDocumentStore', () => {
  it('persists documents, versions, latest reads, opened metadata, and deletion', async () => {
    const store = createDocumentStore({ dataDir: await createTempDir() });

    expect(await store.listDocuments()).toEqual([]);

    const firstBuffer = Buffer.from('first-version');
    const created = await store.saveNewDocument({
      name: 'Proposal Draft.docx',
      buffer: firstBuffer,
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      name: 'Proposal Draft.docx',
      sizeInBytes: firstBuffer.byteLength,
      lastOpenedAt: null,
      versionCount: 1,
    });

    expect(await store.listDocuments()).toEqual([created]);
    expect(Buffer.from(await store.readDocument(created.id))).toEqual(firstBuffer);

    const createdVersions = await store.listDocumentVersions(created.id);
    expect(createdVersions).toHaveLength(1);
    expect(createdVersions[0]).toMatchObject({
      documentId: created.id,
      name: 'Proposal Draft.docx',
      sizeInBytes: firstBuffer.byteLength,
    });

    const renamed = await store.renameDocument(created.id, {
      name: 'Proposal Renamed.docx',
    });

    expect(renamed).toMatchObject({
      id: created.id,
      name: 'Proposal Renamed.docx',
      versionCount: 1,
    });

    const updatedBuffer = Buffer.from('second-version');
    const updated = await store.updateDocument(created.id, {
      name: 'Proposal Final.docx',
      buffer: updatedBuffer,
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Proposal Final.docx',
      sizeInBytes: updatedBuffer.byteLength,
      versionCount: 2,
    });

    expect(await store.listDocuments()).toEqual([updated]);
    expect(Buffer.from(await store.readDocument(created.id))).toEqual(updatedBuffer);

    const versions = await store.listDocumentVersions(created.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({
      documentId: created.id,
      name: 'Proposal Final.docx',
      sizeInBytes: updatedBuffer.byteLength,
    });
    expect(versions[1]).toMatchObject({
      documentId: created.id,
      name: 'Proposal Draft.docx',
      sizeInBytes: firstBuffer.byteLength,
    });

    const firstVersionRecord = await store.readDocumentVersionRecord(created.id, versions[1]!.id);
    expect(Buffer.from(firstVersionRecord.buffer)).toEqual(firstBuffer);

    const latestRecord = await store.readDocumentRecord(created.id, { markOpened: true });
    expect(Buffer.from(latestRecord.buffer)).toEqual(updatedBuffer);
    expect(latestRecord.metadata.lastOpenedAt).not.toBeNull();

    await store.deleteDocument(created.id);
    expect(await store.listDocuments()).toEqual([]);
    await expect(store.readDocument(created.id)).rejects.toThrow(/not found/i);
    await expect(store.listDocumentVersions(created.id)).rejects.toThrow(/not found/i);
  });
});
