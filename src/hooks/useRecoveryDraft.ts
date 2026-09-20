import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearRecoverySnapshot,
  recoverySnapshotIdentityFromSearch,
  readRecoverySnapshot,
  saveRecoverySnapshot,
  type RecoverySnapshot,
  type RecoverySnapshotIdentity,
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
  const saveRecoveryTaskRef = useRef<Promise<RecoverySnapshot | null> | null>(null);
  const recoveryTargetRef = useRef<RecoverySnapshotIdentity | null>(
    typeof window === 'undefined' ? null : recoverySnapshotIdentityFromSearch(window.location.search),
  );
  // Bumped by every discard so in-flight saves stop applying their results.
  const saveEpochRef = useRef(0);

  const refreshRecovery = useCallback(async () => {
    const snapshot = await readRecoverySnapshot(recoveryTargetRef.current);
    setRecoverySnapshot(snapshot);
    return snapshot;
  }, []);

  useEffect(() => {
    void refreshRecovery().catch(() => undefined);
  }, [refreshRecovery]);

  const discardRecovery = useCallback(async () => {
    saveEpochRef.current += 1;
    const discardEpoch = saveEpochRef.current;

    // Let an in-flight autosave settle first; it no-ops because its epoch is
    // stale, so it cannot resurrect the snapshot this discard is removing.
    const pendingTask = saveRecoveryTaskRef.current;
    if (pendingTask) {
      await pendingTask.catch(() => undefined);
    }

    if (discardEpoch !== saveEpochRef.current) {
      return;
    }

    const target =
      recoverySnapshot ?? { sourceKind, documentId, documentName };
    setRecoverySnapshot(null);
    await clearRecoverySnapshot(target)
      .then(refreshRecovery)
      .catch(() => undefined);
  }, [documentId, documentName, recoverySnapshot, refreshRecovery, sourceKind]);

  const saveRecovery = useCallback(async (epoch: number) => {
    const buffer = await getBuffer();
    if (!buffer || epoch !== saveEpochRef.current) {
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

    await saveRecoverySnapshot(snapshot);

    if (epoch !== saveEpochRef.current) {
      await clearRecoverySnapshot(snapshot).catch(() => undefined);
      return null;
    }

    setRecoverySnapshot(snapshot);
    return snapshot;
  }, [activeParaId, documentId, documentName, getBuffer, sourceKind]);

  const saveRecoverySafely = useCallback(() => {
    if (saveRecoveryTaskRef.current) return saveRecoveryTaskRef.current;

    const task = saveRecovery(saveEpochRef.current)
      .catch(() => null)
      .finally(() => {
        saveRecoveryTaskRef.current = null;
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
    discardRecovery,
  };
}
