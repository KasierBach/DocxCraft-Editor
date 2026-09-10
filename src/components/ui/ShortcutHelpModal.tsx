import { Fragment, useEffect, useRef } from 'react';

type ShortcutItem = {
  keys: string[];
  description: string;
};

type ShortcutHelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', 'S'], description: 'Save current document' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Save as new document' },
  { keys: ['Ctrl', 'O'], description: 'Open .docx from computer' },
  { keys: ['Ctrl', '/'], description: 'Show or hide this help' },
  { keys: ['Ctrl', '\\'], description: 'Toggle document outline' },
  { keys: ['Ctrl', 'I'], description: 'Toggle document details' },
  { keys: ['Ctrl', 'P'], description: 'Open command palette' },
];

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    } else if (wasOpenRef.current) {
      previousFocusRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-content shortcut-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
          if (buttons.length < 2) return;
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="modal-header">
          <h2 id="shortcut-help-title">Keyboard shortcuts</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          <ul className="shortcut-list">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.description} className="shortcut-item">
                <span className="shortcut-description">{shortcut.description}</span>
                <span className="shortcut-keys">
                  {shortcut.keys.map((key, index) => (
                    <Fragment key={key}>
                      <kbd className="key-cap">{key}</kbd>
                      {index < shortcut.keys.length - 1 && <span className="key-plus">+</span>}
                    </Fragment>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-button action-button--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}