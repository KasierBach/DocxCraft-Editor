import { memo, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EditorMode } from '@eigenpal/docx-editor-react';
import { Breadcrumbs } from './Breadcrumbs';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useTranslation } from '../../i18n';
import '../../styles/layout/breadcrumbs.css';

type HeaderProps = {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showInfo: boolean;
  onToggleInfo: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
  onSignOut?: () => void;
  onShowDocs?: () => void;
  onShowChangelog?: () => void;
  onShowHome?: () => void;
  onShowLibrary?: () => void;
  onShowSettings?: () => void;
  onShowAssistant?: () => void;
  onShowSignIn?: () => void;
  signInProviders?: Array<{ id: string; label: string }>;
  isAnonymous?: boolean;
};

type OpenMenu = 'export' | 'utility' | null;

const MODE_OPTIONS: Array<{ value: EditorMode; labelKey: string; hintKey: string }> = [
  { value: 'editing', labelKey: 'header.modeEditing', hintKey: 'header.modeEditingHint' },
  { value: 'suggesting', labelKey: 'header.modeSuggesting', hintKey: 'header.modeSuggestingHint' },
  { value: 'viewing', labelKey: 'header.modeViewing', hintKey: 'header.modeViewingHint' },
];

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function getApiStatusLabel(apiStatus: HeaderProps['apiStatus'], t: Translate) {
  switch (apiStatus) {
    case 'connected':
      return t('header.apiOnline');
    case 'offline':
      return t('header.apiOffline');
    case 'checking':
    default:
      return t('header.apiChecking');
  }
}

function HeaderComponent({
  showSidebar,
  onToggleSidebar,
  showInfo,
  onToggleInfo,
  theme,
  onToggleTheme,
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
  onSignOut,
  onShowDocs,
  onShowChangelog,
  onShowHome,
  onShowLibrary,
  onShowSettings,
  onShowAssistant,
  onShowSignIn,
  signInProviders,
  isAnonymous = false,
}: HeaderProps) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);
  const utilityTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (exportMenuRef.current?.contains(target) || utilityMenuRef.current?.contains(target)) {
        return;
      }

      setOpenMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      const trigger = openMenu === 'export' ? exportTriggerRef.current : utilityTriggerRef.current;
      setOpenMenu(null);
      trigger?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    // Capture phase so the preventDefault() below is visible to every
    // bubble-phase Escape handler (drawers, dialogs) and closes only the menu.
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [openMenu]);

  // Move focus into the opened menu so keyboard users land on the first item.
  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    const menuRef = openMenu === 'export' ? exportMenuRef : utilityMenuRef;
    const frameId = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [openMenu]);

  const closeMenus = () => setOpenMenu(null);
  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    if (menuItems.length === 0) {
      return;
    }

    const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowDown':
        nextIndex = (currentIndex + 1 + menuItems.length) % menuItems.length;
        break;
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = menuItems.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    menuItems[nextIndex]?.focus();
  };

  const handleModeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const currentIndex = MODE_OPTIONS.findIndex((option) => option.value === editorMode);
    if (currentIndex === -1) {
      return;
    }

    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) {
      return;
    }

    event.preventDefault();
    const nextMode = MODE_OPTIONS[(currentIndex + delta + MODE_OPTIONS.length) % MODE_OPTIONS.length];
    onEditorModeChange(nextMode.value);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-mode="${nextMode.value}"]`)
      ?.focus();
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
              title={showSidebar ? t('header.hideOutline') : t('header.showOutline')}
              aria-label={showSidebar ? t('header.hideOutline') : t('header.showOutline')}
              aria-pressed={showSidebar}
            >
              {showSidebar ? '<' : '>'}
            </button>
            <button
              type="button"
              className="action-button action-button--menu action-button--menu-secondary"
              onClick={onToggleInfo}
              title={showInfo ? t('header.hideDetails') : t('header.showDetails')}
              aria-label={showInfo ? t('header.hideDetails') : t('header.showDetails')}
              aria-pressed={showInfo}
            >
              {showInfo ? '>' : '<'}
            </button>
            <button
              type="button"
              className="action-button action-button--menu action-button--menu-secondary"
              onClick={onToggleTheme}
              title={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
              aria-label={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <LanguageSwitcher />
          </div>
          <div className="brand__text">
            <div className="brand__title-row">
              <h1 className="logo-text">{t('header.appName')}</h1>
              <div className={`status-badge status-badge--api status-badge--${apiStatus}`}>
                {getApiStatusLabel(apiStatus, t)}
              </div>
            </div>
            <p className="eyebrow">{t('header.tagline')}</p>
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
              placeholder={t('header.documentNamePlaceholder')}
              title={t('header.renameHint')}
              aria-label={t('header.documentNameLabel')}
            />
            {isDirty && (
              <span className="status-badge status-badge--dirty" title={t('statusBar.unsavedChanges')}>
                {t('header.edited')}
              </span>
            )}
          </div>
        </div>
      </div>

        <div className="toolbar">
        <div className="toolbar__actions">
          <div className="mode-picker-group">
            <span className="mode-picker-group__title">{t('header.mode')}</span>
            <div
              className="mode-picker"
              role="radiogroup"
              aria-label={t('header.editingModeLabel')}
              onKeyDown={handleModeKeyDown}
            >
              <span className="mode-picker__icon" aria-hidden="true">✎</span>
              {MODE_OPTIONS.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  data-mode={mode.value}
                  aria-checked={editorMode === mode.value}
                  tabIndex={editorMode === mode.value ? 0 : -1}
                  title={t(mode.hintKey)}
                  className={`mode-picker__option${editorMode === mode.value ? ' mode-picker__option--active' : ''}`}
                  onClick={() => onEditorModeChange(mode.value)}
                >
                  <span className="mode-picker__label">{t(mode.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="action-button action-button--primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? t('header.saving') : t('header.save')}
          </button>

          <button
            type="button"
            className="action-button"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('header.open')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="visually-hidden"
            tabIndex={-1}
            aria-label={t('header.openFileLabel')}
            onChange={onFileChange}
          />

          <div
            ref={exportMenuRef}
            className="toolbar__menu"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOpenMenu(null);
              }
            }}
          >
            <button
              ref={exportTriggerRef}
              type="button"
              className={`action-button action-button--menu-trigger ${openMenu === 'export' ? 'action-button--active' : ''}`}
              onClick={() => toggleMenu('export')}
              aria-expanded={openMenu === 'export'}
              aria-haspopup="menu"
            >
              {t('header.export')}
              <span className="button-caret" aria-hidden="true" />
            </button>

            {openMenu === 'export' && (
              <div
                className="toolbar-dropdown toolbar-dropdown--export"
                role="menu"
                aria-label="Export"
                onKeyDown={handleMenuKeyDown}
              >
                <h4>{t('header.export')}</h4>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onDownloadCurrent();
                  }}
                >
                  {t('header.exportDocx')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onExportMarkdown();
                  }}
                >
                  {t('header.saveMarkdown')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onPrintPDF();
                  }}
                >
                  {t('header.printPdf')}
                </button>
              </div>
            )}
          </div>

          {isAnonymous && signInProviders && signInProviders.length > 0 && onShowSignIn && (
            <button type="button" className="action-button toolbar__signin" onClick={onShowSignIn}>
              {t('auth.signInAction')}
            </button>
          )}

          <div
            ref={utilityMenuRef}
            className="toolbar__menu"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOpenMenu(null);
              }
            }}
          >
            <button
              ref={utilityTriggerRef}
              type="button"
              className={`action-button action-button--icon ${openMenu === 'utility' ? 'action-button--active' : ''}`}
              onClick={() => toggleMenu('utility')}
              title={t('header.moreActions')}
              aria-label={t('header.moreActions')}
              aria-expanded={openMenu === 'utility'}
              aria-haspopup="menu"
            >
              <span className="more-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            {openMenu === 'utility' && (
              <div
                className="toolbar-dropdown toolbar-dropdown--utility"
                role="menu"
                aria-label="More actions"
                onKeyDown={handleMenuKeyDown}
              >
                <h4>{t('header.moreActions')}</h4>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onSaveAs();
                  }}
                >
                  {t('header.saveAsCopy')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onLoadSample();
                  }}
                >
                  {t('header.loadSample')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onReload();
                  }}
                  disabled={!canReload}
                >
                  {t('header.reloadCurrent')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="action-button toolbar-dropdown__button"
                  onClick={() => {
                    closeMenus();
                    onRefresh();
                  }}
                >
                  {t('header.refreshMap')}
                </button>
                {onShowLibrary && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button"
                    onClick={() => {
                      closeMenus();
                      onShowLibrary();
                    }}
                  >
                    {t('header.myDocuments')}
                  </button>
                )}
                {onShowSettings && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button"
                    onClick={() => {
                      closeMenus();
                      onShowSettings();
                    }}
                  >
                    {t('header.settings')}
                  </button>
                )}
                {onShowAssistant && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button"
                    onClick={() => {
                      closeMenus();
                      onShowAssistant();
                    }}
                  >
                    {t('header.aiAssistant')}
                  </button>
                )}
                {(onShowDocs || onShowChangelog || onShowHome) && <h4>{t('header.help')}</h4>}
                {onShowDocs && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button"
                    onClick={() => {
                      closeMenus();
                      onShowDocs();
                    }}
                  >
                    {t('header.documentation')}
                  </button>
                )}
                {onShowChangelog && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button"
                    onClick={() => {
                      closeMenus();
                      onShowChangelog();
                    }}
                  >
                    {t('header.changelog')}
                  </button>
                )}
                {onShowHome && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button"
                    onClick={() => {
                      closeMenus();
                      onShowHome();
                    }}
                  >
                    {t('header.homePage')}
                  </button>
                )}
                {isAnonymous && signInProviders && signInProviders.length > 0 && (
                  <>
                    <h4>{t('auth.signInTitle')}</h4>
                    {signInProviders.map((provider) => (
                      <a
                        key={provider.id}
                        className="action-button toolbar-dropdown__button"
                        href={`/api/auth/${provider.id}/start`}
                        onClick={closeMenus}
                      >
                        {t('header.signInWith', { provider: provider.label })}
                      </a>
                    ))}
                  </>
                )}
                {onSignOut && (
                  <button
                    type="button"
                    role="menuitem"
                    className="action-button toolbar-dropdown__button toolbar-dropdown__button--signout"
                    onClick={() => {
                      closeMenus();
                      onSignOut();
                    }}
                  >
                    {t('header.signOut')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
