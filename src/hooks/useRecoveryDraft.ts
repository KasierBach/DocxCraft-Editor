import { useCallback, useEffect, useState } from 'react';

import {
  clearRecoverySnapshot,
  readRecoverySnapshot,
  saveRecoverySnapshot,
  type RecoverySnapshot,
  type RecoverySourceKind,
} from '../lib/recoveryStore';

type UseRecoveryDraftOptions = {
  sourceKind: RecoverySourceKind;
  documentId: string | null;
  documentName: string;
  activeParaId: string | null;
  isDirty: boolean;
  getBuffer: () => Promise<ArrayBuffer | null>;
  autosaveDelayMs?: number;
};

export function useRecoveryDraft({
  sourceKind,
  documentId,
  documentName,
  activeParaId,
  isDirty,
  getBuffer,
  autosaveDelayMs = 15000,
}: UseRecoveryDraftOptions) {
  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoverySnapshot | null>(() =>
    readRecoverySnapshot(),
  );
  const [isSavingRecovery, setIsSavingRecovery] = useState(false);

  const refreshRecovery = useCallback(() => {
    setRecoverySnapshot(readRecoverySnapshot());
  }, []);

  const discardRecovery = useCallback(() => {
    clearRecoverySnapshot();
    setRecoverySnapshot(null);
  }, []);

  const saveRecovery = useCallback(async () => {
    const buffer = await getBuffer();
    if (!buffer) {
      return null;
    }

    const snapshot: RecoverySnapshot = {
      sourceKind,
      documentId,
      documentName,
      activeParaId,
      savedAt: new Date().toISOString(),
      buffer,
    };
    saveRecoverySnapshot(snapshot);
    setRecoverySnapshot(snapshot);
    return snapshot;
  }, [activeParaId, documentId, documentName, getBuffer, sourceKind]);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIsSavingRecovery(true);
      void saveRecovery().finally(() => {
        setIsSavingRecovery(false);
      });
    }, autosaveDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [autosaveDelayMs, isDirty, saveRecovery]);

  return {
    recoverySnapshot,
    isSavingRecovery,
    saveRecovery,
    discardRecovery,
    refreshRecovery,
  };
}
