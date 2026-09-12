import { useEffect, useRef } from 'react';

type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

type ShortcutConfig = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description?: string;
};

type UseKeyboardShortcutsOptions = {
  shortcuts: ShortcutConfig[];
  enabled?: boolean;
};

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { shortcuts, enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown: KeyboardShortcutHandler = (event) => {
      // Don't trigger shortcuts when typing in input fields
      const activeElement = document.activeElement;
      const isInputField =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (isInputField && !event.metaKey && !event.ctrlKey) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        // Allow either Ctrl or Meta (Cmd) for cross-platform support
        const modifierMatch =
          (shortcut.ctrlKey || shortcut.metaKey)
            ? (event.ctrlKey || event.metaKey) && shiftMatch && altMatch
            : !event.ctrlKey && !event.metaKey && shiftMatch && altMatch;

        if (keyMatch && modifierMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
