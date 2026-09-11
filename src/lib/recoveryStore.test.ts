import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRecoverySnapshot,
  readRecoverySnapshot,
  saveRecoverySnapshot,
  type RecoverySnapshot,
} from './recoveryStore';

function snapshot(overrides: Partial<RecoverySnapshot> = {}): RecoverySnapshot {
  return {
    sourceKind: 'saved-document',
    documentId: 'doc-1',
    documentName: 'Proposal.docx',
    activeParaId: null,
    savedAt: '2026-05-25T11:00:00.000Z',
    buffer: new Uint8Array([1, 2, 3, 4]).buffer,
    ...overrides,
  };
}

describe('recoveryStore', () => {
  afterEach(async () => {
    window.localStorage.clear();
    await clearRecoverySnapshot();
  });

  it('round-trips a recovery snapshot', async () => {
    await saveRecoverySnapshot(snapshot());

    const stored = await readRecoverySnapshot();

    expect(stored?.documentId).toBe('doc-1');
    expect(Array.from(new Uint8Array(stored?.buffer ?? new ArrayBuffer(0)))).toEqual([1, 2, 3, 4]);
  });

  it('keeps per-document snapshots and clears only the selected document', async () => {
    await saveRecoverySnapshot(snapshot({ savedAt: '2026-05-25T10:00:00.000Z' }));
    await saveRecoverySnapshot(
      snapshot({
        documentId: 'doc-2',
        documentName: 'Second.docx',
        savedAt: '2026-05-25T11:00:00.000Z',
      }),
    );
    expect((await readRecoverySnapshot())?.documentId).toBe('doc-2');

    await clearRecoverySnapshot(snapshot({ documentId: 'doc-2', documentName: 'Second.docx' }));
    expect((await readRecoverySnapshot())?.documentId).toBe('doc-1');
  });

  it('clears every stored snapshot', async () => {
    await saveRecoverySnapshot(snapshot({ sourceKind: 'sample', documentId: null }));

    await clearRecoverySnapshot();
    expect(await readRecoverySnapshot()).toBeNull();
  });

  it('returns the most recently saved snapshot across documents', async () => {
    await saveRecoverySnapshot(snapshot({ documentId: 'doc-a', savedAt: '2026-05-25T10:00:00.000Z' }));
    await saveRecoverySnapshot(snapshot({ documentId: 'doc-b', savedAt: '2026-05-25T12:00:00.000Z' }));
    await saveRecoverySnapshot(snapshot({ documentId: 'doc-c', savedAt: '2026-05-25T11:00:00.000Z' }));

    expect((await readRecoverySnapshot())?.documentId).toBe('doc-b');
  });

  it('keys unsaved drafts by source kind and name', async () => {
    await saveRecoverySnapshot(
      snapshot({
        sourceKind: 'local-file',
        documentId: null,
        documentName: 'Draft.docx',
        savedAt: '2026-05-25T10:00:00.000Z',
      }),
    );
    await saveRecoverySnapshot(
      snapshot({
        sourceKind: 'sample',
        documentId: null,
        documentName: 'Built-in sample.docx',
        savedAt: '2026-05-25T11:00:00.000Z',
      }),
    );

    expect((await readRecoverySnapshot())?.documentName).toBe('Built-in sample.docx');

    await clearRecoverySnapshot({
      sourceKind: 'sample',
      documentId: null,
      documentName: 'Built-in sample.docx',
    });

    expect((await readRecoverySnapshot())?.documentName).toBe('Draft.docx');
  });

  it('overwrites the snapshot for the same document key', async () => {
    await saveRecoverySnapshot(snapshot({ buffer: new Uint8Array([1]).buffer }));
    await saveRecoverySnapshot(snapshot({ savedAt: '2026-05-25T12:00:00.000Z', buffer: new Uint8Array([9, 9]).buffer }));

    const stored = await readRecoverySnapshot();
    expect(Array.from(new Uint8Array(stored?.buffer ?? new ArrayBuffer(0)))).toEqual([9, 9]);
  });

  it('round-trips an empty buffer', async () => {
    await saveRecoverySnapshot(snapshot({ buffer: new ArrayBuffer(0) }));

    const stored = await readRecoverySnapshot();
    expect(stored?.buffer.byteLength).toBe(0);
  });

  it('preserves the active paragraph id and save timestamp', async () => {
    await saveRecoverySnapshot(
      snapshot({ activeParaId: 'para-42', savedAt: '2026-05-25T09:30:00.000Z' }),
    );

    const stored = await readRecoverySnapshot();
    expect(stored?.activeParaId).toBe('para-42');
    expect(stored?.savedAt).toBe('2026-05-25T09:30:00.000Z');
  });
});
