import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

import { useTranslation } from '../../../i18n';
import { deleteAccount, exportAccount, listDocuments } from '../../../lib/documentApi';
import { triggerBlobDownload } from '../../../lib/download';
import { formatBytes, formatDateTime } from '../../../lib/format';
import { hardNavigate } from '../../../lib/navigation';
import {
  clearRecoverySnapshot,
  listRecoverySnapshots,
  type RecoverySnapshot,
} from '../../../lib/recoveryStore';
import { useAccountActivity } from '../useAccountActivity';

/** Export, storage, unsaved work, and account deletion. */
export function DataSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const documentsQuery = useQuery({ queryKey: ['account', 'documents'], queryFn: listDocuments });
  const recoveryQuery = useQuery({
    queryKey: ['account', 'recovery'],
    queryFn: listRecoverySnapshots,
  });
  const activity = useAccountActivity();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const snapshots = recoveryQuery.data ?? [];
  const totalBytes = (documentsQuery.data ?? []).reduce(
    (sum, document) => sum + document.sizeInBytes,
    0,
  );
  const lastExport = activity.events.find((event) => event.action === 'account.export') ?? null;

  const discardMutation = useMutation({
    mutationFn: (draft: RecoverySnapshot) => clearRecoverySnapshot(draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['account', 'recovery'] }),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const json = await exportAccount();
      triggerBlobDownload('docxcraft-export.json', new Blob([json], { type: 'application/json' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      hardNavigate('/');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="profile-section-stack">
      <section className="profile-section">
        <h2>{t('profile.sectionData')}</h2>
        <dl className="profile-fields">
          <div className="profile-field-row">
            <dt>{t('profile.totalStorage')}</dt>
            <dd>{formatBytes(totalBytes)}</dd>
          </div>
        </dl>
      </section>

      <section className="profile-section">
        <h3>{t('profile.exportTitle')}</h3>
        <p className="panel-copy">{t('profile.exportHint')}</p>
        <p className="panel-copy">
          {lastExport
            ? t('profile.lastExported', { date: formatDateTime(lastExport.createdAt) })
            : t('profile.neverExported')}
        </p>
        <div className="profile-actions">
          <button
            type="button"
            className="action-button"
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            {isExporting ? t('profile.exporting') : t('profile.export')}
          </button>
        </div>
      </section>

      <section className="profile-section">
        <h3>{t('profile.unsavedWork')}</h3>
        {snapshots.length > 0 ? (
          <ul className="documents-list">
            {snapshots.map((draft) => {
              const search = new URLSearchParams({
                recoverySource: draft.sourceKind,
                recoveryName: draft.documentName,
              });
              if (draft.documentId) search.set('recoveryDocumentId', draft.documentId);

              return (
                <li key={`${draft.sourceKind}:${draft.documentId ?? draft.documentName}`} className="saved-document-card">
                  <strong className="saved-document-card__name">{draft.documentName}</strong>
                  <span className="saved-document-card__meta">{formatDateTime(draft.savedAt)}</span>
                  <div className="profile-actions">
                    <Link className="action-button" to={`/app?${search.toString()}`}>
                      {t('profile.restoreInEditor')}
                    </Link>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => discardMutation.mutate(draft)}
                      disabled={discardMutation.isPending}
                    >
                      {t('profile.discardDraft')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="panel-copy">{t('profile.noUnsavedWork')}</p>
        )}
      </section>

      <section className="profile-section">
        <h3>{t('profile.deleteTitle')}</h3>
        <p className="panel-copy">{t('profile.deleteHint')}</p>
        {isConfirmingDelete ? (
          <div className="profile-actions">
            <p className="saved-document-card__warning" role="status">
              {t('profile.deleteConfirm')}
            </p>
            <button
              type="button"
              className="action-button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? t('profile.deleting') : t('profile.confirmDelete')}
            </button>
            <button
              type="button"
              className="action-button"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
            >
              {t('profile.cancel')}
            </button>
          </div>
        ) : (
          <div className="profile-actions">
            <button
              type="button"
              className="action-button"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('profile.deleteAccount')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
