import { useEffect, useRef, type RefObject } from 'react';

type UseModalDialogOptions = {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClosed?: () => void;
};

/**
 * Shared open/close lifecycle for modal dialogs: saves and restores focus,
 * moves initial focus into the dialog, and closes on Escape while honouring
 * handlers that already consumed the event.
 */
export function useModalDialog({
  isOpen,
  onClose,
  initialFocusRef,
  onClosed,
}: UseModalDialogOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onCloseRef.current = onClose;
    onClosedRef.current = onClosed;
  }, [onClose, onClosed]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const frameId = window.requestAnimationFrame(() => initialFocusRef.current?.focus());
      wasOpenRef.current = true;
      return () => window.cancelAnimationFrame(frameId);
    }

    if (wasOpenRef.current) {
      previousFocusRef.current?.focus();
      onClosedRef.current?.();
    }
    wasOpenRef.current = false;
  }, [isOpen, initialFocusRef]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
}
