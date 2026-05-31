import React from 'react';

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
  { keys: ['Ctrl', '/'], description: 'Show/hide this help' },
  { keys: ['Ctrl', '\\'], description: 'Toggle left sidebar' },
  { keys: ['Ctrl', 'I'], description: 'Toggle right sidebar' },
  { keys: ['Ctrl', 'P'], description: 'Command Palette' },
];

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content shortcut-help" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <ul className="shortcut-list">
            {SHORTCUTS.map((shortcut, index) => (
              <li key={index} className="shortcut-item">
                <span className="shortcut-description">{shortcut.description}</span>
                <div className="shortcut-keys">
                  {shortcut.keys.map((key, kIndex) => (
                    <React.Fragment key={kIndex}>
                      <kbd className="key-cap">{key}</kbd>
                      {kIndex < shortcut.keys.length - 1 && <span className="key-plus">+</span>}
                    </React.Fragment>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-button action-button--primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
