import { useMemo } from 'react';

import { formatTime } from '../../lib/format';
import { useTranslation } from '../../i18n';

type EditorStatusBarProps = {
  wordCount: number;
  pageCount: number;
  currentPage: number | null;
  lastSavedAt: string | null;
  isDirty: boolean;
  onShowShortcuts: () => void;
};

export function EditorStatusBar({
  wordCount,
  pageCount,
  currentPage,
  lastSavedAt,
  isDirty,
  onShowShortcuts,
}: EditorStatusBarProps) {
  const { t } = useTranslation();
  const formattedLastSaved = useMemo(() => {
    if (isDirty) return t('statusBar.unsavedChanges');
    if (!lastSavedAt) return t('statusBar.notSavedYet');
    return t('statusBar.savedAt', { time: formatTime(lastSavedAt) });
  }, [isDirty, lastSavedAt, t]);

  return (
    <footer className="editor-status-bar">
      <div className="editor-status-bar__left">
        <div className="status-segment">
          <span className="status-label">{t('statusBar.words')}</span>
          <span className="status-value">{wordCount.toLocaleString()}</span>
        </div>
        <div className="status-segment">
          <span className="status-label">
            {currentPage !== null ? t('statusBar.pageNumber', { page: currentPage }) : t('statusBar.page')}
          </span>
          <span className="status-label">{t('statusBar.of')}</span>
          <span className="status-value">{pageCount}</span>
        </div>
      </div>
      
      <div className="editor-status-bar__center">
        <span
          className={`save-status ${isDirty ? 'save-status--dirty' : ''}`}
          aria-live="polite"
        >
          {formattedLastSaved}
        </span>
      </div>
      
      <div className="editor-status-bar__right">
        <button
          type="button"
          className="status-button"
          onClick={onShowShortcuts}
          title={t('statusBar.shortcutsTitle')}
        >
          <span className="status-icon" aria-hidden="true">⌨️</span>
          <span className="status-button__label">{t('statusBar.shortcuts')}</span>
        </button>
      </div>
    </footer>
  );
}
