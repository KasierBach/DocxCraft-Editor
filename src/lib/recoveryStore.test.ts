import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRecoverySnapshot,
  readRecoverySnapshot,
  saveRecoverySnapshot,
} from './recoveryStore';

describe('recoveryStore', () => {
  afterEach(() => {
    clearRecoverySnapshot();
  });

  it('round-trips a recovery snapshot through localStorage', () => {
    saveRecoverySnapshot({
      sourceKind: 'saved-document',
      documentId: 'doc-1',
      documentName: 'Proposal.docx',
      activeParaId: 'para-1',
      savedAt: '2026-05-25T11:00:00.000Z',
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
    });

    const snapshot = readRecoverySnapshot();

    expect(snapshot).not.toBeNull();
    expect(snapshot?.documentId).toBe('doc-1');
    expect(Array.from(new Uint8Array(snapshot?.buffer ?? new ArrayBuffer(0)))).toEqual([1, 2, 3, 4]);
  });

  it('clears the stored snapshot', () => {
    saveRecoverySnapshot({
      sourceKind: 'sample',
      documentId: null,
      documentName: 'Built-in sample.docx',
      activeParaId: null,
      savedAt: '2026-05-25T11:00:00.000Z',
      buffer: new Uint8Array([9, 9]).buffer,
    });

    clearRecoverySnapshot();

    expect(readRecoverySnapshot()).toBeNull();
  });
});
