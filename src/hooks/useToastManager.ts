import { useCallback, useEffect, useRef, useState } from 'react';

import type { ToastItem } from '../components/ToastViewport';

type ToastTone = ToastItem['tone'];

type UseToastManagerOptions = {
  defaultTimeout?: number;
};

type UseToastManagerResult = {
  toasts: ToastItem[];
  pushToast: (tone: ToastTone, message: string) => void;
  dismissToast: (toastId: number) => void;
};

export function useToastManager(options: UseToastManagerOptions = {}): UseToastManagerResult {
  const { defaultTimeout = 4000 } = options;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);
  const toastTimerRefs = useRef(new Map<number, number>());

  const clearToastTimer = useCallback((toastId: number) => {
    const timerId = toastTimerRefs.current.get(toastId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      toastTimerRefs.current.delete(toastId);
    }
  }, []);

  const clearAllToastTimers = useCallback(() => {
    for (const timerId of toastTimerRefs.current.values()) {
      window.clearTimeout(timerId);
    }
    toastTimerRefs.current.clear();
  }, []);

  const dismissToast = useCallback((toastId: number) => {
    clearToastTimer(toastId);
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, [clearToastTimer]);

  const pushToast = useCallback(
    (tone: ToastTone, message: string) => {
      clearAllToastTimers();
      const toastId = toastIdRef.current + 1;
      toastIdRef.current = toastId;
      setToasts([{ id: toastId, tone, message }]);

      const timerId = window.setTimeout(() => {
        dismissToast(toastId);
      }, defaultTimeout);
      toastTimerRefs.current.set(toastId, timerId);
    },
    [clearAllToastTimers, defaultTimeout, dismissToast],
  );

  useEffect(() => {
    return () => {
      clearAllToastTimers();
    };
  }, [clearAllToastTimers]);

  return { toasts, pushToast, dismissToast };
}
