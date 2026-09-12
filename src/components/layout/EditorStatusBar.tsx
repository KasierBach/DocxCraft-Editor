import { useMemo } from 'react';

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
  const formattedLastSaved = useMemo(() => {
    if (isDirty) return 'Unsaved changes';
    if (!lastSavedAt) return 'Not saved yet';

    const savedAt = new Date(lastSavedAt);
    if (Number.isNaN(savedAt.getTime())) {
      return `Saved at ${lastSavedAt}`;
    }

    return `Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [isDirty, lastSavedAt]);

  return (
    <footer className="editor-status-bar">
      <div className="editor-status-bar__left">
        <div className="status-segment">
          <span className="status-label">Words</span>
          <span className="status-value">{wordCount.toLocaleString()}</span>
        </div>
        <div className="status-segment">
          <span className="status-label">{currentPage !== null ? `Page ${currentPage}` : 'Page'}</span>
          <span className="status-label">of</span>
          <span className="status-value">{pageCount}</span>
        </div>
      </div>
      
      <div className="editor-status-bar__center">
        <span className={`save-status ${isDirty ? 'save-status--dirty' : ''}`}>
          {formattedLastSaved}
        </span>
      </div>
      
      <div className="editor-status-bar__right">
        <button 
          type="button" 
          className="status-button"
          onClick={onShowShortcuts}
          title="See keyboard shortcuts"
        >
          <span className="status-icon">⌨️</span>
          Shortcuts
        </button>
      </div>
    </footer>
  );
}
