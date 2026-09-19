import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '../../i18n';
import { listTrash, purgeDocument, restoreDocument } from '../../lib/documentApi';
import { formatBytes, formatRelativeTime } from '../../lib/format';
import { DOCUMENTS_KEY, TRASH_KEY } from './queryKeys';

/**
 * Trashed documents with a restore/permanent-delete choice. Purging is
 * destructive, so it reuses the library's two-step confirm pattern.
 */
export function TrashView() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmingPurgeId, setConfirmingPurgeId] = useState<string | null>(null);

  const trashQuery = useQuery({ queryKey: TRASH_KEY, queryFn: listTrash });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
    void queryClient.invalidateQueries({ queryKey: TRASH_KEY });
  };

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreDocument(id),
    onSuccess: invalidate,
  });

  const purgeMutation = useMutation({
    mutationFn: (id: string) => purgeDocument(id),
    onSuccess: () => {
      setConfirmingPurgeId(null);
      invalidate();
    },
  });

  if (trashQuery.isLoading) {
    return <p className="panel-copy">{t('documents.loadingSaved')}</p>;
  }

  if (trashQuery.isError) {
    return (
      <div className="documents-page__state" role="alert">
        <p className="panel-copy">{t('library.trashLoadFailed')}</p>
        <button type="button" className="action-button" onClick={() => void trashQuery.refetch()}>
          {t('library.retry')}
        </button>
      </div>
    );
  }

  const trashed = trashQuery.data ?? [];
  if (trashed.length === 0) {
    return <p className="panel-copy">{t('library.trashEmpty')}</p>;
  }

  return (
    <ul className="documents-list">
      {trashed.map((document) => (
        <li key={document.id} className="saved-document-card">
          {confirmingPurgeId === document.id ? (
            <>
              <p className="saved-document-card__warning" role="status">
                {t('library.purgeConfirm')}
              </p>
              <div className="saved-document-card__actions">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => purgeMutation.mutate(document.id)}
                  disabled={purgeMutation.isPending}
                  aria-label={t('library.confirmPurgeLabel', { name: document.name })}
                >
                  {purgeMutation.isPending
                    ? t('library.deletingForever')
                    : t('library.confirmPurge')}
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => setConfirmingPurgeId(null)}
                  disabled={purgeMutation.isPending}
                  aria-label={t('library.cancelPurgeLabel', { name: document.name })}
                >
                  {t('documents.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="saved-document-card__name">{document.name}</span>
              <span className="saved-document-card__meta">
                {formatBytes(document.sizeInBytes)} |{' '}
                {t('library.deleted', {
                  time: document.deletedAt
                    ? (formatRelativeTime(document.deletedAt, language) ??
                      t('documents.unknown'))
                    : t('documents.unknown'),
                })}
              </span>
              <span className="saved-document-card__meta">
                {t('documents.versionsCount', { count: document.versionCount })}
              </span>
              <div className="saved-document-card__actions">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => restoreMutation.mutate(document.id)}
                  disabled={restoreMutation.isPending}
                  aria-label={t('library.restoreLabel', { name: document.name })}
                >
                  {restoreMutation.isPending ? t('library.restoring') : t('library.restore')}
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => setConfirmingPurgeId(document.id)}
                  aria-label={t('library.deleteForeverLabel', { name: document.name })}
                >
                  {t('library.deleteForever')}
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
