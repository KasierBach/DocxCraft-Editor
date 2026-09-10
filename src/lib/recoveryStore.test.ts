import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRecoverySnapshot,
  readRecoverySnapshot,
  saveRecoverySnapshot,
} from './recoveryStore';

describe('recoveryStore', () => {
  afterEach(async () => {
    await clearRecoverySnapshot();
  });

  it('round-trips a recovery snapshot', async () => {
    await saveRecoverySnapshot({
      sourceKind: 'saved-document',
      documentId: 'doc-1',
      documentName: 'Proposal.docx',
      activeParaId: 'para-1',
      savedAt: '2026-05-25T11:00:00.000Z',
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
    });

    const snapshot = await readRecoverySnapshot();

    expect(snapshot?.documentId).toBe('doc-1');
    expect(Array.from(new Uint8Array(snapshot?.buffer ?? new ArrayBuffer(0)))).toEqual([1, 2, 3, 4]);
  });

  it('keeps per-document snapshots and clears only the selected document', async () => {
    const first = {
      sourceKind: 'saved-document' as const,
      documentId: 'doc-1',
      documentName: 'First.docx',
      activeParaId: null,
      savedAt: '2026-05-25T11:00:00.000Z',
      buffer: new Uint8Array([1]).buffer,
    };
    const second = {
      ...first,
      documentId: 'doc-2',
      documentName: 'Second.docx',
      savedAt: '2026-05-25T12:00:00.000Z',
      buffer: new Uint8Array([2]).buffer,
    };

    await saveRecoverySnapshot(first);
    await saveRecoverySnapshot(second);
    expect((await readRecoverySnapshot())?.documentId).toBe('doc-2');

    await clearRecoverySnapshot(second);
    expect((await readRecoverySnapshot())?.documentId).toBe('doc-1');
  });

  it('clears every stored snapshot', async () => {
    await saveRecoverySnapshot({
      sourceKind: 'sample',
      documentId: null,
      documentName: 'Built-in sample.docx',
      activeParaId: null,
      savedAt: '2026-05-25T11:00:00.000Z',
      buffer: new Uint8Array([9, 9]).buffer,
    });

    await clearRecoverySnapshot();
    expect(await readRecoverySnapshot()).toBeNull();
  });
});