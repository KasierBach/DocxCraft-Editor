import { useCallback, useEffect, useRef, useState } from 'react';

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
  autosaveDelayMs = 10000,
}: UseRecoveryDraftOptions) {
  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoverySnapshot | null>(null);
  const [isSavingRecovery, setIsSavingRecovery] = useState(false);
  const saveRecoveryTaskRef = useRef<Promise<RecoverySnapshot | null> | null>(null);

  const refreshRecovery = useCallback(async () => {
    const snapshot = await readRecoverySnapshot();
    setRecoverySnapshot(snapshot);
    return snapshot;
  }, []);

  useEffect(() => {
    void refreshRecovery().catch(() => undefined);
  }, [refreshRecovery]);

  const discardRecovery = useCallback(() => {
    const target =
      recoverySnapshot ?? { sourceKind, documentId, documentName };
    setRecoverySnapshot(null);
    void clearRecoverySnapshot(target)
      .then(refreshRecovery)
      .catch(() => undefined);
  }, [documentId, documentName, recoverySnapshot, refreshRecovery, sourceKind]);

  const saveRecovery = useCallback(async () => {
    const buffer = await getBuffer();
    if (!buffer) return null;

    const snapshot: RecoverySnapshot = {
      sourceKind,
      documentId,
      documentName,
      activeParaId,
      savedAt: new Date().toISOString(),
      buffer,
    };

    await saveRecoverySnapshot(snapshot);
    setRecoverySnapshot(snapshot);
    return snapshot;
  }, [activeParaId, documentId, documentName, getBuffer, sourceKind]);

  const saveRecoverySafely = useCallback(() => {
    if (saveRecoveryTaskRef.current) return saveRecoveryTaskRef.current;

    setIsSavingRecovery(true);
    const task = saveRecovery()
      .catch(() => null)
      .finally(() => {
        saveRecoveryTaskRef.current = null;
        setIsSavingRecovery(false);
      });
    saveRecoveryTaskRef.current = task;
    return task;
  }, [saveRecovery]);

  useEffect(() => {
    if (!isDirty) return;

    const timerId = window.setTimeout(() => {
      void saveRecoverySafely();
    }, autosaveDelayMs);

    return () => window.clearTimeout(timerId);
  }, [autosaveDelayMs, isDirty, saveRecoverySafely]);

  useEffect(() => {
    if (!isDirty) return;

    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') void saveRecoverySafely();
    };
    const saveOnPageHide = () => {
      void saveRecoverySafely();
    };

    document.addEventListener('visibilitychange', saveWhenHidden);
    window.addEventListener('pagehide', saveOnPageHide);
    return () => {
      document.removeEventListener('visibilitychange', saveWhenHidden);
      window.removeEventListener('pagehide', saveOnPageHide);
    };
  }, [isDirty, saveRecoverySafely]);

  return {
    recoverySnapshot,
    isSavingRecovery,
    saveRecovery,
    discardRecovery,
    refreshRecovery,
  };
}