import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';

import { useTranslation } from '../../../i18n';
import { listDocuments, type SavedDocumentSummary } from '../../../lib/documentApi';
import { formatBytes, formatDateTime } from '../../../lib/format';

const DOCUMENTS_KEY = ['account', 'documents'];
const RECENT_LIMIT = 3;
const TABLE_LIMIT = 5;

function recentlyOpened(documents: SavedDocumentSummary[]) {
  return documents
    .filter(
      (document): document is SavedDocumentSummary & { lastOpenedAt: string } =>
        document.lastOpenedAt !== null,
    )
    .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
    .slice(0, RECENT_LIMIT);
}

function recentlyUpdated(documents: SavedDocumentSummary[]) {
  return [...documents]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, TABLE_LIMIT);
}

/** Documents the visitor can continue, capped so the full library stays at /documents. */
export function WorkspaceSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const documentsQuery = useQuery({ queryKey: DOCUMENTS_KEY, queryFn: listDocuments });

  const documents = documentsQuery.data ?? [];
  const openDocument = (documentId: string) => {
    navigate(`/app?source=saved&documentId=${encodeURIComponent(documentId)}`);
  };

  if (documentsQuery.isLoading) {
    return <p className="panel-copy">{t('profile.loading')}</p>;
  }

  if (documentsQuery.isError) {
    return (
      <div className="profile-state" role="alert">
        <p className="panel-copy">{t('profile.loadFailed')}</p>
        <button type="button" className="action-button" onClick={() => void documentsQuery.refetch()}>
          {t('profile.retry')}
        </button>
      </div>
    );
  }

  const recent = recentlyOpened(documents);
  const updated = recentlyUpdated(documents);

  return (
    <div className="profile-section-stack">
      <section className="profile-section">
        <h2>{t('profile.workspacePickUp')}</h2>
        {recent.length === 0 ? (
          <p className="panel-copy">{t('profile.workspaceEmpty')}</p>
        ) : (
          <ul className="profile-list">
            {recent.map((document) => (
              <li key={document.id} className="profile-list__row">
                <div className="profile-list__main">
                  <span className="profile-list__name">{document.name}</span>
                  <span className="profile-list__meta">
                    {t('profile.tableVersions')}: {document.versionCount} ·{' '}
                    {formatBytes(document.sizeInBytes)}
                  </span>
                </div>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => openDocument(document.id)}
                >
                  {t('profile.open')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-section">
        <h2>{t('profile.recentDocuments')}</h2>
        {updated.length === 0 ? (
          <p className="panel-copy">{t('profile.workspaceEmpty')}</p>
        ) : (
          <table className="profile-table">
            <thead>
              <tr>
                <th scope="col">{t('profile.tableName')}</th>
                <th scope="col">{t('profile.tableUpdated')}</th>
                <th scope="col">{t('profile.tableVersions')}</th>
                <th scope="col">{t('profile.tableSize')}</th>
              </tr>
            </thead>
            <tbody>
              {updated.map((document) => (
                <tr key={document.id}>
                  <td>
                    <button
                      type="button"
                      className="profile-table__open"
                      onClick={() => openDocument(document.id)}
                    >
                      {document.name}
                    </button>
                  </td>
                  <td>{formatDateTime(document.updatedAt)}</td>
                  <td>{document.versionCount}</td>
                  <td>{formatBytes(document.sizeInBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="profile-actions">
          <Link className="action-button" to="/documents">
            {t('profile.openLibrary')}
          </Link>
        </div>
      </section>
    </div>
  );
}
