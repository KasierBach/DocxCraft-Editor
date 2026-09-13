import { useCallback, useState } from 'react';

import type { SavedDocumentSummary, SavedDocumentVersionSummary } from '../../lib/documentApi';
import type { RecoverySnapshot } from '../../lib/recoveryStore';
import type { MediaItem } from '../../lib/mediaScanner';
import { formatDateTime } from '../../lib/format';
import { MediaManagerPanel } from '../MediaManagerPanel';
import { SavedDocumentsPanel } from '../SavedDocumentsPanel';
import { VersionHistoryPanel } from '../VersionHistoryPanel';
import { Panel } from '../ui/Panel';
import { DrawerCloseButton } from '../ui/DrawerCloseButton';
import { useTranslation } from '../../i18n';

type RightSidebarProps = {
  activeParaId: string | null;
  documentName: string;
  currentPage: number | null;
  currentTargetLabel: string;
  currentDocumentId: string | null;
  currentDocumentVersions: SavedDocumentVersionSummary[];
  savedDocuments: SavedDocumentSummary[];
  isLoadingDocuments: boolean;
  isLoadingVersions: boolean;
  recoverySnapshot: RecoverySnapshot | null;
  mediaItems: MediaItem[];
  onRestoreRecovery: () => void | Promise<void>;
  onDiscardRecovery: () => void;
  onOpenDocument: (documentId: string) => void | Promise<void>;
  onRenameDocument: (documentId: string, name: string) => void | Promise<void>;
  onDeleteDocument: (documentId: string) => void | Promise<void>;
  onDuplicateDocument: (documentId: string) => void | Promise<void>;
  onDownloadDocument: (documentId: string) => void | Promise<void>;
  onRefreshDocuments: () => void | Promise<void>;
  onRestoreVersion: (documentId: string, versionId: string) => void | Promise<void>;
  onDownloadVersion: (documentId: string, versionId: string) => void | Promise<void>;
  onJumpToMedia: (paraId: string) => void;
  onClose?: () => void;
};

export function RightSidebar({
  activeParaId,
  documentName,
  currentPage,
  currentTargetLabel,
  currentDocumentId,
  currentDocumentVersions,
  savedDocuments,
  isLoadingDocuments,
  isLoadingVersions,
  recoverySnapshot,
  mediaItems,
  onRestoreRecovery,
  onDiscardRecovery,
  onOpenDocument,
  onRenameDocument,
  onDeleteDocument,
  onDuplicateDocument,
  onDownloadDocument,
  onRefreshDocuments,
  onRestoreVersion,
  onDownloadVersion,
  onJumpToMedia,
  onClose,
}: RightSidebarProps) {
  const { t } = useTranslation();
  const [isRestoringRecovery, setIsRestoringRecovery] = useState(false);

  const handleRestoreRecovery = useCallback(async () => {
    setIsRestoringRecovery(true);
    try {
      await onRestoreRecovery();
    } finally {
      setIsRestoringRecovery(false);
    }
  }, [onRestoreRecovery]);

  return (
    <aside className="right-sidebar" aria-label={t('documents.regionLabel')}>
      {onClose && <DrawerCloseButton ariaLabel={t('documents.closeLabel')} onClick={onClose} />}
      <Panel title={t('documents.currentTarget')}>
        <dl className="meta-grid">
          <div>
            <dt>{t('documents.document')}</dt>
            <dd>{documentName}</dd>
          </div>
          <div>
            <dt>{t('documents.selectedId')}</dt>
            <dd>{activeParaId ?? t('documents.none')}</dd>
          </div>
          <div>
            <dt>{t('documents.currentPage')}</dt>
            <dd>{currentPage ?? t('documents.unknown')}</dd>
          </div>
          <div>
            <dt>{t('documents.preview')}</dt>
            <dd>{currentTargetLabel}</dd>
          </div>
        </dl>
      </Panel>

      <MediaManagerPanel items={mediaItems} onJumpToParaId={onJumpToMedia} />

      {recoverySnapshot && (
        <Panel title={t('documents.recoveryDraft')}>
          <p className="panel-copy">
            {t('documents.recoveryAvailable', { time: formatDateTime(recoverySnapshot.savedAt) })}
          </p>
          <div className="saved-document-card__actions">
            <button
              type="button"
              className="action-button"
              onClick={() => {
                void handleRestoreRecovery();
              }}
              disabled={isRestoringRecovery}
            >
              {isRestoringRecovery ? t('documents.restoring') : t('documents.restore')}
            </button>
            <button
              type="button"
              className="action-button"
              onClick={onDiscardRecovery}
              disabled={isRestoringRecovery}
            >
              {t('documents.dismiss')}
            </button>
          </div>
        </Panel>
      )}

      <VersionHistoryPanel
        documentName={documentName}
        documentId={currentDocumentId}
        versions={currentDocumentVersions}
        isLoading={isLoadingVersions}
        onRestore={onRestoreVersion}
        onDownload={onDownloadVersion}
      />

      <SavedDocumentsPanel
        documents={savedDocuments}
        currentDocumentId={currentDocumentId}
        isLoading={isLoadingDocuments}
        onOpen={onOpenDocument}
        onRefresh={onRefreshDocuments}
        onRename={onRenameDocument}
        onDelete={onDeleteDocument}
        onDuplicate={onDuplicateDocument}
        onDownload={onDownloadDocument}
      />
    </aside>
  );
}
