import { Fragment, useRef } from 'react';

import { useModalDialog } from '../../hooks/useModalDialog';
import { useTranslation } from '../../i18n';

export type ShortcutDisplayEntry = {
  keys: string[];
  description: string;
};

const FOCUSABLE_SELECTOR =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type ShortcutHelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutDisplayEntry[];
};

export function ShortcutHelpModal({ isOpen, onClose, shortcuts }: ShortcutHelpModalProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useModalDialog({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef,
  });

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
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
          ).filter((element) => !element.hasAttribute('disabled'));
          if (focusable.length < 2) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
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
          <h2 id="shortcut-help-title">{t('shortcuts.title')}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label={t('shortcuts.closeLabel')}
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          <ul className="shortcut-list">
            {shortcuts.map((shortcut) => (
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
            {t('shortcuts.close')}
          </button>
        </div>
      </section>
    </div>
  );
}
