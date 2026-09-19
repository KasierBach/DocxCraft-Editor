import { useEffect, useRef } from 'react';

type UseAutosaveOptions = {
  /** Autosave only runs while true: an unsaved draft must not create documents by itself. */
  enabled: boolean;
  isDirty: boolean;
  save: () => Promise<unknown>;
  delayMs?: number;
};

/**
 * Saves once editing settles, so a refresh or a crash cannot lose work that the
 * user never explicitly saved. Deliberately silent: the caller's own status
 * surface reports the result, because this runs every few seconds and a toast
 * per save would be unusable.
 */
export function useAutosave({ enabled, isDirty, save, delayMs = 3000 }: UseAutosaveOptions) {
  // Held in a ref so a caller passing an inline callback cannot re-arm the
  // debounce on every render, which would postpone the save indefinitely.
  const saveRef = useRef(save);
  const isSavingRef = useRef(false);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!enabled || !isDirty || isSavingRef.current) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      isSavingRef.current = true;
      // The save function reports its own failures; this catch only stops a
      // rejected autosave becoming an unhandled rejection. The next edit
      // re-arms the timer rather than looping on a failing save.
      void saveRef
        .current()
        .catch(() => undefined)
        .finally(() => {
          isSavingRef.current = false;
        });
    }, delayMs);

    return () => window.clearTimeout(timerId);
  }, [delayMs, enabled, isDirty]);
}
