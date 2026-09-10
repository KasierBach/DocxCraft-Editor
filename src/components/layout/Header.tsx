import { memo, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { EditorMode } from '@eigenpal/docx-editor-react';
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
  onExportMarkdown: () => void;
  onPrintPDF: () => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
};

type OpenMenu = 'export' | 'utility' | null;

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

function HeaderComponent({
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
  onExportMarkdown,
  onPrintPDF,
  editorMode,
  onEditorModeChange,
}: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (exportMenuRef.current?.contains(target) || utilityMenuRef.current?.contains(target)) {
        return;
      }

      setOpenMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const closeMenus = () => setOpenMenu(null);
  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <header className="topbar">
      <div className="topbar__identity">
        <div className="brand">
          <div className="brand__controls">
            <button
              type="button"
              className="action-button action-button--menu"
              onClick={onToggleSidebar}
              title={showSidebar ? 'Hide outline' : 'Show outline'}
              aria-label={showSidebar ? 'Hide document outline' : 'Show document outline'}
              aria-pressed={showSidebar}
            >
              {showSidebar ? '<' : '>'}
            </button>
            <button
              type="button"
              className="action-button action-button--menu action-button--menu-secondary"
              onClick={onToggleInfo}
              title={showInfo ? 'Hide details' : 'Show details'}
              aria-label={showInfo ? 'Hide document details' : 'Show document details'}
              aria-pressed={showInfo}
            >
              {showInfo ? '>' : '<'}
            </button>
          </div>
          <div className="brand__text">
            <div className="brand__title-row">
              <h1 className="logo-text">DOCX Workspace</h1>
              <div className={`status-badge status-badge--api status-badge--${apiStatus}`}>
                {getApiStatusLabel(apiStatus)}
              </div>
            </div>
            <p className="eyebrow">Review and navigate</p>
          </div>
        </div>

        <div className="document-info">
          <Breadcrumbs documentName={documentName} sourceKind={sourceKind} />
          <div className="document-title-row">
            <input
              type="text"
              className="document-name-input"
              value={documentName}
              onChange={(event) => onDocumentNameChange(event.target.value)}
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
          <label className="mode-picker">
            <span className="visually-hidden">Editing mode</span>
            <select
              value={editorMode}
              onChange={(event) => onEditorModeChange(event.target.value as EditorMode)}
              aria-label="Editing mode"
            >
              <option value="editing">Editing</option>
              <option value="suggesting">Suggesting</option>
              <option value="viewing">Viewing</option>
            </select>
          </label>

          <button
            type="button"
            className="action-button action-button--primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <label className="action-button action-button--file">
            Open
            <input type="file" accept=".docx" onChange={onFileChange} style={{ display: 'none' }} />
          </label>

          <div ref={exportMenuRef} className="toolbar__menu">
            <button
              type="button"
              className={`action-button action-button--menu-trigger ${openMenu === 'export' ? 'action-button--active' : ''}`}
              onClick={() => toggleMenu('export')}
              aria-expanded={openMenu === 'export'}
              aria-haspopup="true"
            >
              Export
              <span className="button-caret" aria-hidden="true" />
            </button>

            {openMenu === 'export' && (
              <div className="toolbar-dropdown toolbar-dropdown--export">
                <h4>Export</h4>
                <button
                  type="button"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onDownloadCurrent();
                  }}
                >
                  Export .docx
                </button>
                <button
                  type="button"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onExportMarkdown();
                  }}
                >
                  Save as Markdown (.md)
                </button>
                <button
                  type="button"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onPrintPDF();
                  }}
                >
                  Print as PDF
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="action-button action-button--refresh"
            onClick={onRefresh}
          >
            Refresh Map
          </button>

          <div ref={utilityMenuRef} className="toolbar__menu">
            <button
              type="button"
              className={`action-button action-button--icon ${openMenu === 'utility' ? 'action-button--active' : ''}`}
              onClick={() => toggleMenu('utility')}
              title="More actions"
              aria-label="More actions"
              aria-expanded={openMenu === 'utility'}
              aria-haspopup="true"
            >
              <span className="more-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            {openMenu === 'utility' && (
              <div className="toolbar-dropdown toolbar-dropdown--utility">
                <h4>More actions</h4>
                <button
                  type="button"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onSaveAs();
                  }}
                >
                  Save as Copy
                </button>
                <button
                  type="button"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onLoadSample();
                  }}
                >
                  Load Sample
                </button>
                <button
                  type="button"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onReload();
                  }}
                  disabled={!canReload}
                >
                  Reload Current Document
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
