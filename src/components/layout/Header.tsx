import type { ChangeEvent } from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import '../../styles/layout/breadcrumbs.css';

type HeaderProps = {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showInfo: boolean;
  onToggleInfo: () => void;
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  isDirty: boolean;
  apiStatus: 'checking' | 'connected' | 'offline';
  onLoadSample: () => void;
  onReload: () => void;
  canReload: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onDownloadCurrent: () => void;
  isSaving: boolean;
  onRefresh: () => void;
  sourceKind: string;
};

function getApiStatusLabel(apiStatus: HeaderProps['apiStatus']) {
  switch (apiStatus) {
    case 'connected':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'checking':
    default:
      return 'Checking';
  }
}

export function Header({
  showSidebar,
  onToggleSidebar,
  showInfo,
  onToggleInfo,
  documentName,
  onDocumentNameChange,
  isDirty,
  apiStatus,
  onLoadSample,
  onReload,
  canReload,
  onFileChange,
  onSave,
  onSaveAs,
  onDownloadCurrent,
  isSaving,
  onRefresh,
  sourceKind,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar__identity">
        <div className="brand">
          <div className="brand__controls">
            <button
              type="button"
              className="action-button action-button--menu"
              onClick={onToggleSidebar}
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? '‹' : '›'}
            </button>
            <button
              type="button"
              className="action-button action-button--menu action-button--menu-secondary"
              onClick={onToggleInfo}
              title={showInfo ? 'Hide metadata' : 'Show metadata'}
            >
              {showInfo ? '›' : '‹'}
            </button>
          </div>
          <div className="brand__text">
            <div className="brand__title-row">
              <h1 className="logo-text">DOCX EDITOR</h1>
              <div className={`status-badge status-badge--api status-badge--${apiStatus}`}>
                {getApiStatusLabel(apiStatus)}
              </div>
            </div>
            <p className="eyebrow">Anchor Navigator</p>
          </div>
        </div>

        <div className="document-info">
          <Breadcrumbs documentName={documentName} sourceKind={sourceKind} />
          <div className="document-title-row">
            <input
              type="text"
              className="document-name-input"
              value={documentName}
              onChange={(e) => onDocumentNameChange(e.target.value)}
              placeholder="Untitled document"
              title="Click to rename"
            />
            {isDirty && (
              <span className="status-badge status-badge--dirty" title="Unsaved changes">
                Edited
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__actions">
          <div className="toolbar__group">
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="action-button" onClick={onSaveAs}>
              Copy
            </button>
          </div>

          <div className="toolbar__group">
            <label className="action-button action-button--file">
              Open
              <input type="file" accept=".docx" onChange={onFileChange} style={{ display: 'none' }} />
            </label>
            <button type="button" className="action-button" onClick={onDownloadCurrent}>
              Export
            </button>
          </div>

          <div className="toolbar__group">
            <button type="button" className="action-button" onClick={onLoadSample}>
              Sample
            </button>
            <button
              type="button"
              className="action-button"
              onClick={onReload}
              disabled={!canReload}
            >
              Reload
            </button>
            <button
              type="button"
              className="action-button action-button--refresh"
              onClick={onRefresh}
            >
              Refresh Map
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
