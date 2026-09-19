import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';

import { useTranslation } from '../../i18n';
import {
  deleteDocument,
  listDocuments,
  readDocumentContent,
  renameDocument,
  type SavedDocumentSummary,
} from '../../lib/documentApi';
import { triggerBlobDownload } from '../../lib/download';
import { formatBytes, formatDateTime } from '../../lib/format';
import { TrashView } from './TrashView';
import { DOCUMENTS_KEY } from './queryKeys';

/**
 * The hosted documents library: a TanStack Query-backed dashboard over the same
 * document API the editor uses. Opening a document hands off to the editor via
 * the existing deep link (`/app?source=saved&documentId=…`).
 */
export function DocumentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const view = searchParams.get('view') === 'trash' ? 'trash' : 'documents';
  const setView = (next: 'documents' | 'trash') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'trash') {
      params.set('view', 'trash');
    } else {
      params.delete('view');
    }
    setSearchParams(params);
  };

  const documentsQuery = useQuery({ queryKey: DOCUMENTS_KEY, queryFn: listDocuments });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameDocument(id, name),
    onSuccess: () => {
      setRenaming(null);
      void invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setConfirmingDeleteId(null);
      void invalidate();
    },
  });

  const openDocument = (document: SavedDocumentSummary) => {
    navigate(`/app?source=saved&documentId=${encodeURIComponent(document.id)}`);
  };

  const downloadDocument = async (document: SavedDocumentSummary) => {
    const buffer = await readDocumentContent(document.id);
    triggerBlobDownload(document.name, new Blob([buffer]));
  };

  const documents = documentsQuery.data ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? documents.filter((document) => document.name.toLowerCase().includes(normalizedSearch))
    : documents;

  const chrome = (
    <>
      <header className="documents-page__header">
        <div>
          <h1 className="documents-page__title">{t('library.title')}</h1>
          <p className="documents-page__intro">{t('library.intro')}</p>
        </div>
        <button
          type="button"
          className="action-button"
          onClick={() => navigate('/app')}
        >
          {t('library.backToEditor')}
        </button>
      </header>

      <div className="documents-page__view-toggle" role="group" aria-label={t('library.viewLabel')}>
        <button
          type="button"
          className="action-button"
          aria-pressed={view === 'documents'}
          onClick={() => setView('documents')}
        >
          {t('library.viewDocuments')}
        </button>
        <button
          type="button"
          className="action-button"
          aria-pressed={view === 'trash'}
          onClick={() => setView('trash')}
        >
          {t('library.viewTrash')}
        </button>
      </div>
    </>
  );

  if (view === 'trash') {
    return (
      <main className="documents-page">
        {chrome}
        <TrashView />
      </main>
    );
  }

  return (
    <main className="documents-page">
      {chrome}
      <div className="filter-group">
        <input
          type="search"
          className="filter-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('documents.searchSavedPlaceholder')}
          aria-label={t('documents.searchSavedLabel')}
        />
        <button
          type="button"
          className="action-button"
          onClick={() => void invalidate()}
          disabled={documentsQuery.isFetching}
        >
          {documentsQuery.isFetching ? t('documents.refreshing') : t('documents.refresh')}
        </button>
      </div>

      {documentsQuery.isLoading ? (
        <p className="panel-copy">{t('documents.loadingSaved')}</p>
      ) : documentsQuery.isError ? (
        <div className="documents-page__state" role="alert">
          <p className="panel-copy">{t('library.loadFailed')}</p>
          <button type="button" className="action-button" onClick={() => void documentsQuery.refetch()}>
            {t('library.retry')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="panel-copy">
          {documents.length === 0 ? t('documents.noSaved') : t('documents.noMatchSearch')}
        </p>
      ) : (
        <ul className="documents-list">
          {filtered.map((document) => (
            <li key={document.id} className="saved-document-card">
              {renaming?.id === document.id ? (
                <>
                  <input
                    type="text"
                    className="document-name-input"
                    value={renaming.name}
                    aria-label={t('documents.editNameLabel', { name: document.name })}
                    onChange={(event) => setRenaming({ id: document.id, name: event.target.value })}
                  />
                  <div className="saved-document-card__actions">
                    <button
                      type="button"
                      className="action-button"
                      onClick={() =>
                        renameMutation.mutate({ id: document.id, name: renaming.name })
                      }
                      disabled={renameMutation.isPending}
                      aria-label={t('documents.saveNameLabel', { name: document.name })}
                    >
                      {renameMutation.isPending ? t('documents.saving') : t('documents.save')}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => setRenaming(null)}
                      disabled={renameMutation.isPending}
                      aria-label={t('documents.cancelRenameLabel', { name: document.name })}
                    >
                      {t('documents.cancel')}
                    </button>
                  </div>
                </>
              ) : confirmingDeleteId === document.id ? (
                <>
                  <p className="saved-document-card__warning" role="status">
                    {t('documents.deleteConfirm')}
                  </p>
                  <div className="saved-document-card__actions">
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => deleteMutation.mutate(document.id)}
                      disabled={deleteMutation.isPending}
                      aria-label={t('documents.confirmDeleteLabel', { name: document.name })}
                    >
                      {deleteMutation.isPending ? t('documents.deleting') : t('documents.confirm')}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={deleteMutation.isPending}
                      aria-label={t('documents.cancelDeleteLabel', { name: document.name })}
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
                    onClick={() => openDocument(document)}
                    aria-label={t('documents.openLabel', { name: document.name })}
                  >
                    <span className="saved-document-card__name">{document.name}</span>
                    <span className="saved-document-card__meta">
                      {formatBytes(document.sizeInBytes)} |{' '}
                      {t('documents.updated', { date: formatDateTime(document.updatedAt) })}
                    </span>
                    <span className="saved-document-card__meta">
                      {t('documents.versionsCount', { count: document.versionCount })}
                    </span>
                  </button>
                  <div className="saved-document-card__actions">
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => void downloadDocument(document)}
                      aria-label={t('documents.downloadLabel', { name: document.name })}
                    >
                      {t('documents.download')}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => setRenaming({ id: document.id, name: document.name })}
                      aria-label={t('documents.renameLabel', { name: document.name })}
                    >
                      {t('documents.edit')}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => setConfirmingDeleteId(document.id)}
                      aria-label={t('documents.deleteLabel', { name: document.name })}
                    >
                      {t('documents.delete')}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
