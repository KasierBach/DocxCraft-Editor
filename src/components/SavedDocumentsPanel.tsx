import { useMemo, useState } from 'react';

import type { SavedDocumentSummary } from '../lib/documentApi';
import { Panel } from './ui/Panel';

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

function formatBytes(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  const sizeInKb = sizeInBytes / 1024;
  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(1)} KB`;
  }

  return `${(sizeInKb / 1024).toFixed(1)} MB`;
}

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
              aria-label={`Edit name for ${document.name}`}
              disabled={pendingType === 'rename'}
            />
            <div className="saved-document-card__actions">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void saveRename(document.id);
                }}
                aria-label={`Save name for ${document.name}`}
                disabled={pendingType === 'rename'}
              >
                {pendingType === 'rename' ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={cancelRename}
                aria-label={`Cancel rename for ${document.name}`}
                disabled={pendingType === 'rename'}
              >
                Cancel
              </button>
            </div>
          </>
        ) : isConfirmingDelete ? (
          <>
            <p className="saved-document-card__warning">Delete this saved document?</p>
            <div className="saved-document-card__actions">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void confirmDeleteAction(document.id);
                }}
                aria-label={`Confirm delete ${document.name}`}
                disabled={pendingType === 'delete'}
              >
                {pendingType === 'delete' ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={cancelDelete}
                aria-label={`Cancel delete ${document.name}`}
                disabled={pendingType === 'delete'}
              >
                Cancel
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
              aria-label={`Open ${document.name}`}
              disabled={pendingType !== null}
            >
              <span className="saved-document-card__name">{document.name}</span>
              <span className="saved-document-card__meta">
                {formatBytes(document.sizeInBytes)} | Updated {new Date(document.updatedAt).toLocaleString()}
              </span>
              <span className="saved-document-card__meta">
                Versions {document.versionCount}
                {document.lastOpenedAt
                  ? ` | Opened ${new Date(document.lastOpenedAt).toLocaleString()}`
                  : ''}
              </span>
              {pendingType === 'open' && (
                <span className="saved-document-card__status">Opening...</span>
              )}
            </button>
            <div className="saved-document-card__actions saved-document-card__actions--wrap">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void runAction(document.id, 'download', onDownload);
                }}
                aria-label={`Download ${document.name}`}
                disabled={pendingType !== null}
              >
                {pendingType === 'download' ? 'Downloading...' : 'Download'}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void runAction(document.id, 'duplicate', onDuplicate);
                }}
                aria-label={`Duplicate ${document.name}`}
                disabled={pendingType !== null}
              >
                {pendingType === 'duplicate' ? 'Duplicating...' : 'Duplicate'}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => startRename(document)}
                aria-label={`Rename ${document.name}`}
                disabled={pendingType !== null}
              >
                Edit
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => confirmDelete(document.id)}
                aria-label={`Delete ${document.name}`}
                disabled={pendingType !== null}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Panel title="Saved documents">
      <div className="saved-documents-toolbar">
        <p className="panel-copy">
          Keep the current editor state on the backend, then reopen it later from this list.
        </p>
        <button
          type="button"
          className="action-button"
          onClick={() => {
            void handleRefresh();
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="filter-group">
        <input
          type="search"
          className="filter-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search saved docs..."
          aria-label="Search saved documents"
        />
        <select
          className="filter-select"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          aria-label="Sort saved documents"
        >
          <option value="updated-desc">Updated</option>
          <option value="opened-desc">Recent</option>
          <option value="name-asc">Name</option>
        </select>
      </div>

      {isLoading ? (
        <p className="panel-copy">Loading saved documents...</p>
      ) : documents.length === 0 ? (
        <p className="panel-copy">No saved documents yet.</p>
      ) : (
        <>
          {shouldShowRecentSection && (
            <div className="saved-documents-section">
              <p className="saved-documents-section__title">Recent</p>
              <div className="saved-documents-list">{recentDocuments.map(renderDocumentCard)}</div>
            </div>
          )}

          {(!shouldShowRecentSection || primaryDocuments.length > 0 || filteredDocuments.length === 0) && (
            <div className="saved-documents-section">
              <p className="saved-documents-section__title">
                {searchQuery.trim()
                  ? `Search results (${filteredDocuments.length})`
                  : shouldShowRecentSection
                    ? 'More documents'
                    : 'All documents'}
              </p>
              {filteredDocuments.length === 0 ? (
                <p className="panel-copy">No saved documents match that search.</p>
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
