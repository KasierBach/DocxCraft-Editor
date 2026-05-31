import type { SavedDocumentSummary, SavedDocumentVersionSummary } from '../../lib/documentApi';
import type { RecoverySnapshot } from '../../lib/recoveryStore';
import { SavedDocumentsPanel } from '../SavedDocumentsPanel';
import { VersionHistoryPanel } from '../VersionHistoryPanel';
import { Panel } from '../ui/Panel';

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
  onRestoreRecovery: () => void;
  onDiscardRecovery: () => void;
  onOpenDocument: (documentId: string) => void | Promise<void>;
  onRenameDocument: (documentId: string, name: string) => void | Promise<void>;
  onDeleteDocument: (documentId: string) => void | Promise<void>;
  onDuplicateDocument: (documentId: string) => void | Promise<void>;
  onDownloadDocument: (documentId: string) => void | Promise<void>;
  onRefreshDocuments: () => void | Promise<void>;
  onRestoreVersion: (documentId: string, versionId: string) => void | Promise<void>;
  onDownloadVersion: (documentId: string, versionId: string) => void | Promise<void>;
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
}: RightSidebarProps) {
  return (
    <aside className="right-sidebar">
      <Panel title="Current target">
        <dl className="meta-grid">
          <div>
            <dt>Document</dt>
            <dd>{documentName}</dd>
          </div>
          <div>
            <dt>Selected ID</dt>
            <dd>{activeParaId ?? 'None'}</dd>
          </div>
          <div>
            <dt>Current Page</dt>
            <dd>{currentPage ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt>Preview</dt>
            <dd>{currentTargetLabel}</dd>
          </div>
        </dl>
      </Panel>

      {recoverySnapshot && (
        <Panel title="Recovery draft">
          <p className="panel-copy">
            Unsaved work from {new Date(recoverySnapshot.savedAt).toLocaleString()} is available.
          </p>
          <div className="saved-document-card__actions">
            <button type="button" className="action-button" onClick={onRestoreRecovery}>
              Restore
            </button>
            <button type="button" className="action-button" onClick={onDiscardRecovery}>
              Dismiss
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
