import { useMemo, useState } from 'react';

import type { SavedDocumentSummary } from '../lib/documentApi';
import { formatBytes, formatDateTime } from '../lib/format';
import { Panel } from './ui/Panel';
import { useTranslation } from '../i18n';

type SavedDocumentsPanelProps = {
  documents: SavedDocumentSummary[];
  currentDocumentId: string | null;
  isLoading: boolean;
  onOpen: (documentId: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onRename: (documentId: string, name: string) => void | Promise<void>;
  onDelete: (documentId: string) => void | Promise<void>;
  onDuplicate: (documentId: string) => void | Promise<void>;
  onDownload: (documentId: string) => void | Promise<void>;
};

type PendingDocumentAction =
  | { documentId: string; type: 'open' }
  | { documentId: string; type: 'rename' }
  | { documentId: string; type: 'delete' }
  | { documentId: string; type: 'duplicate' }
  | { documentId: string; type: 'download' };

type SortMode = 'updated-desc' | 'opened-desc' | 'name-asc';

function sortDocuments(documents: SavedDocumentSummary[], sortMode: SortMode) {
  const nextDocuments = [...documents];

  switch (sortMode) {
    case 'opened-desc':
      return nextDocuments.sort((left, right) =>
        `${right.lastOpenedAt ?? ''}`.localeCompare(`${left.lastOpenedAt ?? ''}`),
      );
    case 'name-asc':
      return nextDocuments.sort((left, right) => left.name.localeCompare(right.name));
    case 'updated-desc':
    default:
      return nextDocuments.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}

export function SavedDocumentsPanel({
  documents,
  currentDocumentId,
  isLoading,
  onOpen,
  onRefresh,
  onRename,
  onDelete,
  onDuplicate,
  onDownload,
}: SavedDocumentsPanelProps) {
  const { t } = useTranslation();
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<string | null>(null);
  const [pendingDocumentAction, setPendingDocumentAction] = useState<PendingDocumentAction | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc');

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matchingDocuments = query
      ? documents.filter((document) => document.name.toLowerCase().includes(query))
      : documents;

    return sortDocuments(matchingDocuments, sortMode);
  }, [documents, searchQuery, sortMode]);

  const recentDocuments = useMemo(
    () =>
      documents
        .filter((document) => document.lastOpenedAt)
        .sort((left, right) => `${right.lastOpenedAt ?? ''}`.localeCompare(`${left.lastOpenedAt ?? ''}`))
        .slice(0, 3),
    [documents],
  );

  const shouldShowRecentSection = searchQuery.trim() === '' && recentDocuments.length > 0;
  const recentDocumentIds = useMemo(
    () => new Set(recentDocuments.map((document) => document.id)),
    [recentDocuments],
  );
  const primaryDocuments = useMemo(() => {
    if (!shouldShowRecentSection) {
      return filteredDocuments;
    }

    return filteredDocuments.filter((document) => !recentDocumentIds.has(document.id));
  }, [filteredDocuments, recentDocumentIds, shouldShowRecentSection]);

  const startRename = (document: SavedDocumentSummary) => {
    setConfirmDeleteDocumentId(null);
    setEditingDocumentId(document.id);
    setDraftName(document.name);
  };

  const cancelRename = () => {
    setEditingDocumentId(null);
    setDraftName('');
  };

  const runAction = async (
    documentId: string,
    type: PendingDocumentAction['type'],
    callback: (documentId: string) => void | Promise<void>,
  ) => {
    setPendingDocumentAction({
      documentId,
      type,
    });

    try {
      await callback(documentId);
    } finally {
      setPendingDocumentAction((currentAction) =>
        currentAction?.documentId === documentId && currentAction.type === type
          ? null
          : currentAction,
      );
    }
  };

  const saveRename = async (documentId: string) => {
    const nextName = draftName.trim();
    if (!nextName) {
      return;
    }

    setPendingDocumentAction({
      documentId,
      type: 'rename',
    });

    try {
      await onRename(documentId, nextName);
      cancelRename();
    } finally {
      setPendingDocumentAction((currentAction) =>
        currentAction?.documentId === documentId && currentAction.type === 'rename'
          ? null
          : currentAction,
      );
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const confirmDelete = (documentId: string) => {
    cancelRename();
    setConfirmDeleteDocumentId(documentId);
  };

  const cancelDelete = () => {
    setConfirmDeleteDocumentId(null);
  };

  const confirmDeleteAction = async (documentId: string) => {
    setPendingDocumentAction({
      documentId,
      type: 'delete',
    });

    try {
      await onDelete(documentId);
      cancelDelete();
    } finally {
      setPendingDocumentAction((currentAction) =>
        currentAction?.documentId === documentId && currentAction.type === 'delete'
          ? null
          : currentAction,
      );
    }
  };

  const renderDocumentCard = (document: SavedDocumentSummary) => {
    const isActive = document.id === currentDocumentId;
    const isEditing = document.id === editingDocumentId;
    const isConfirmingDelete = document.id === confirmDeleteDocumentId;
    const pendingType =
      pendingDocumentAction?.documentId === document.id ? pendingDocumentAction.type : null;

    return (
      <div
        key={document.id}
        className="saved-document-card"
        data-active={isActive ? 'true' : 'false'}
        aria-busy={pendingType ? 'true' : 'false'}
      >
        {isEditing ? (
          <>
            <input
              type="text"
              className="saved-document-card__input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void saveRename(document.id);
                } else if (event.key === 'Escape') {
                  cancelRename();
                }
              }}
              aria-label={t('documents.editNameLabel', { name: document.name })}
              disabled={pendingType === 'rename'}
            />
            <div className="saved-document-card__actions">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void saveRename(document.id);
                }}
                aria-label={t('documents.saveNameLabel', { name: document.name })}
                disabled={pendingType === 'rename'}
              >
                {pendingType === 'rename' ? t('documents.saving') : t('documents.save')}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={cancelRename}
                aria-label={t('documents.cancelRenameLabel', { name: document.name })}
                disabled={pendingType === 'rename'}
              >
                {t('documents.cancel')}
              </button>
            </div>
          </>
        ) : isConfirmingDelete ? (
          <>
            <p className="saved-document-card__warning" role="status">
              {t('documents.deleteConfirm')}
            </p>
            <div className="saved-document-card__actions">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void confirmDeleteAction(document.id);
                }}
                aria-label={t('documents.confirmDeleteLabel', { name: document.name })}
                disabled={pendingType === 'delete'}
              >
                {pendingType === 'delete' ? t('documents.deleting') : t('documents.confirm')}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={cancelDelete}
                aria-label={t('documents.cancelDeleteLabel', { name: document.name })}
                disabled={pendingType === 'delete'}
              >
                {t('documents.cancel')}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="saved-document-card__open"
              data-active={isActive ? 'true' : 'false'}
              onClick={() => {
                void runAction(document.id, 'open', onOpen);
              }}
              aria-label={t('documents.openLabel', { name: document.name })}
              disabled={pendingType !== null}
            >
              <span className="saved-document-card__name">{document.name}</span>
              <span className="saved-document-card__meta">
                {formatBytes(document.sizeInBytes)} |{' '}
                {t('documents.updated', { date: formatDateTime(document.updatedAt) })}
              </span>
              <span className="saved-document-card__meta">
                {t('documents.versionsCount', { count: document.versionCount })}
                {document.lastOpenedAt
                  ? ` | ${t('documents.opened', { date: formatDateTime(document.lastOpenedAt) })}`
                  : ''}
              </span>
              {pendingType === 'open' && (
                <span className="saved-document-card__status">{t('documents.opening')}</span>
              )}
            </button>
            <div className="saved-document-card__actions saved-document-card__actions--wrap">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void runAction(document.id, 'download', onDownload);
                }}
                aria-label={t('documents.downloadLabel', { name: document.name })}
                disabled={pendingType !== null}
              >
                {pendingType === 'download' ? t('documents.downloading') : t('documents.download')}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void runAction(document.id, 'duplicate', onDuplicate);
                }}
                aria-label={t('documents.duplicateLabel', { name: document.name })}
                disabled={pendingType !== null}
              >
                {pendingType === 'duplicate' ? t('documents.duplicating') : t('documents.duplicate')}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => startRename(document)}
                aria-label={t('documents.renameLabel', { name: document.name })}
                disabled={pendingType !== null}
              >
                {t('documents.edit')}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => confirmDelete(document.id)}
                aria-label={t('documents.deleteLabel', { name: document.name })}
                disabled={pendingType !== null}
              >
                {t('documents.delete')}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Panel title={t('documents.savedTitle')}>
      <div className="saved-documents-toolbar">
        <p className="panel-copy">{t('documents.savedCopy')}</p>
        <button
          type="button"
          className="action-button"
          onClick={() => {
            void handleRefresh();
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? t('documents.refreshing') : t('documents.refresh')}
        </button>
      </div>

      <div className="filter-group">
        <input
          type="search"
          className="filter-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('documents.searchSavedPlaceholder')}
          aria-label={t('documents.searchSavedLabel')}
        />
        <select
          className="filter-select"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          aria-label={t('documents.sortLabel')}
        >
          <option value="updated-desc">{t('documents.sortUpdated')}</option>
          <option value="opened-desc">{t('documents.sortRecent')}</option>
          <option value="name-asc">{t('documents.sortName')}</option>
        </select>
      </div>

      {isLoading ? (
        <p className="panel-copy">{t('documents.loadingSaved')}</p>
      ) : documents.length === 0 ? (
        <p className="panel-copy">{t('documents.noSaved')}</p>
      ) : (
        <>
          {shouldShowRecentSection && (
            <div className="saved-documents-section">
              <p className="saved-documents-section__title">{t('documents.recent')}</p>
              <div className="saved-documents-list">{recentDocuments.map(renderDocumentCard)}</div>
            </div>
          )}

          {(!shouldShowRecentSection || primaryDocuments.length > 0 || filteredDocuments.length === 0) && (
            <div className="saved-documents-section">
              <p className="saved-documents-section__title">
                {searchQuery.trim()
                  ? t('documents.searchResults', { count: filteredDocuments.length })
                  : shouldShowRecentSection
                    ? t('documents.moreDocuments')
                    : t('documents.allDocuments')}
              </p>
              {filteredDocuments.length === 0 ? (
                <p className="panel-copy">{t('documents.noMatchSearch')}</p>
              ) : (
                <div className="saved-documents-list">{primaryDocuments.map(renderDocumentCard)}</div>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
