import { useState } from 'react';

import type { SavedDocumentVersionSummary } from '../lib/documentApi';
import { formatBytes, formatDateTime } from '../lib/format';
import { Panel } from './ui/Panel';
import { useTranslation } from '../i18n';

type VersionHistoryPanelProps = {
  documentName: string;
  documentId: string | null;
  versions: SavedDocumentVersionSummary[];
  isLoading: boolean;
  onRestore: (documentId: string, versionId: string) => void | Promise<void>;
  onDownload: (documentId: string, versionId: string) => void | Promise<void>;
};

export function VersionHistoryPanel({
  documentName,
  documentId,
  versions,
  isLoading,
  onRestore,
  onDownload,
}: VersionHistoryPanelProps) {
  const { t } = useTranslation();
  const [pendingAction, setPendingAction] = useState<{
    versionId: string;
    type: 'restore' | 'download';
  } | null>(null);

  const handleAction = async (
    versionId: string,
    type: 'restore' | 'download',
    callback: (targetDocumentId: string, targetVersionId: string) => void | Promise<void>,
  ) => {
    if (!documentId) {
      return;
    }

    setPendingAction({ versionId, type });

    try {
      await callback(documentId, versionId);
    } finally {
      setPendingAction((currentAction) =>
        currentAction?.versionId === versionId && currentAction.type === type ? null : currentAction,
      );
    }
  };

  return (
    <Panel title={t('documents.versionTitle')}>
      {!documentId ? (
        <p className="panel-copy">{t('documents.versionSaveFirst')}</p>
      ) : isLoading ? (
        <p className="panel-copy">{t('documents.versionLoading', { name: documentName })}</p>
      ) : versions.length === 0 ? (
        <p className="panel-copy">{t('documents.versionEmpty')}</p>
      ) : (
        <div className="version-history-list">
          {versions.map((version, index) => {
            const isPending = pendingAction?.versionId === version.id;

            return (
              <div
                key={version.id}
                className="saved-document-card"
                aria-busy={isPending ? 'true' : 'false'}
              >
                <span className="saved-document-card__name">
                  {index === 0
                    ? t('documents.latestVersion')
                    : t('documents.versionNumber', { number: versions.length - index })}
                </span>
                <span className="saved-document-card__meta">
                  {formatDateTime(version.createdAt)} | {formatBytes(version.sizeInBytes)}
                </span>
                <div className="saved-document-card__actions">
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => {
                      void handleAction(version.id, 'download', onDownload);
                    }}
                    disabled={isPending}
                    aria-label={t('documents.downloadVersionLabel', { date: formatDateTime(version.createdAt) })}
                  >
                    {pendingAction?.versionId === version.id && pendingAction.type === 'download'
                      ? t('documents.downloading')
                      : t('documents.download')}
                  </button>
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => {
                      void handleAction(version.id, 'restore', onRestore);
                    }}
                    disabled={isPending}
                    aria-label={t('documents.restoreVersionLabel', { date: formatDateTime(version.createdAt) })}
                  >
                    {pendingAction?.versionId === version.id && pendingAction.type === 'restore'
                      ? t('documents.restoring')
                      : t('documents.restore')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
