import { useState } from 'react';

import type { SavedDocumentVersionSummary } from '../lib/documentApi';
import { Panel } from './ui/Panel';

type VersionHistoryPanelProps = {
  documentName: string;
  documentId: string | null;
  versions: SavedDocumentVersionSummary[];
  isLoading: boolean;
  onRestore: (documentId: string, versionId: string) => void | Promise<void>;
  onDownload: (documentId: string, versionId: string) => void | Promise<void>;
};

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

export function VersionHistoryPanel({
  documentName,
  documentId,
  versions,
  isLoading,
  onRestore,
  onDownload,
}: VersionHistoryPanelProps) {
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
    <Panel title="Version history">
      {!documentId ? (
        <p className="panel-copy">Save this document to the library to start version tracking.</p>
      ) : isLoading ? (
        <p className="panel-copy">Loading versions for {documentName}...</p>
      ) : versions.length === 0 ? (
        <p className="panel-copy">No versions available yet.</p>
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
                  {index === 0 ? 'Latest version' : `Version ${versions.length - index}`}
                </span>
                <span className="saved-document-card__meta">
                  {new Date(version.createdAt).toLocaleString()} | {formatBytes(version.sizeInBytes)}
                </span>
                <div className="saved-document-card__actions">
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => {
                      void handleAction(version.id, 'download', onDownload);
                    }}
                    disabled={isPending}
                    aria-label={`Download version from ${new Date(version.createdAt).toLocaleString()}`}
                  >
                    {pendingAction?.versionId === version.id && pendingAction.type === 'download'
                      ? 'Downloading...'
                      : 'Download'}
                  </button>
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => {
                      void handleAction(version.id, 'restore', onRestore);
                    }}
                    disabled={isPending}
                    aria-label={`Restore version from ${new Date(version.createdAt).toLocaleString()}`}
                  >
                    {pendingAction?.versionId === version.id && pendingAction.type === 'restore'
                      ? 'Restoring...'
                      : 'Restore'}
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
