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
  shortcutsRef.current = shortcuts;

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
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        // Allow either Ctrl or Meta (Cmd) for cross-platform support
        const modifierMatch =
          (shortcut.ctrlKey || shortcut.metaKey)
            ? (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
            : ctrlMatch && metaMatch && shiftMatch && altMatch;

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

/**
 * Returns a list of available keyboard shortcuts for display purposes.
 */
export function getShortcutDescription(shortcut: ShortcutConfig): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push('Ctrl');
  }
  if (shortcut.metaKey) {
    parts.push('Cmd');
  }
  if (shortcut.shiftKey) {
    parts.push('Shift');
  }
  if (shortcut.altKey) {
    parts.push('Alt');
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}
