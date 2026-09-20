import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTranslation } from '../../i18n';
import { listProviders } from '../../lib/accountApi';
import { readAuthSession, type SavedDocumentSummary } from '../../lib/documentApi';
import { formatBytes, formatRelativeTime } from '../../lib/format';
import { listRecoverySnapshots } from '../../lib/recoveryStore';
import { useAuthGate } from '../auth/AuthGateContext';

type ProfileHeaderProps = {
  documents: SavedDocumentSummary[];
};

/** Same-origin: the provider photo is proxied so the browser can load it. */
const ACCOUNT_AVATAR_PATH = '/api/account/avatar';

function initialsFor(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split('@')[0] || '';
  const initials = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || '?';
}

function newestUpdate(documents: SavedDocumentSummary[]) {
  return documents.reduce<string | null>(
    (latest, document) =>
      latest === null || document.updatedAt > latest ? document.updatedAt : latest,
    null,
  );
}

/** Identity block and the workspace stat strip at the top of the profile page. */
export function ProfileHeader({ documents }: ProfileHeaderProps) {
  const { t, language } = useTranslation();
  const { providers } = useAuthGate();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: readAuthSession });
  const recoveryQuery = useQuery({
    queryKey: ['account', 'recovery'],
    queryFn: listRecoverySnapshots,
  });
  const providersQuery = useQuery({ queryKey: ['account', 'providers'], queryFn: listProviders });

  const user = sessionQuery.data?.user;
  const lastEdited = newestUpdate(documents);
  const joinedAt = user?.createdAt ? formatRelativeTime(user.createdAt, language) : null;
  const linkedProviderIds = new Set((providersQuery.data ?? []).map((provider) => provider.id));

  return (
    <section className="profile-header">
      <div className="profile-header__identity">
        <div className="profile-avatar" aria-hidden="true">
          {user?.avatarUrl && !avatarFailed ? (
            <img
              className="profile-avatar__image"
              src={ACCOUNT_AVATAR_PATH}
              alt=""
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            initialsFor(user?.name, user?.email)
          )}
        </div>
        <div className="profile-identity">
          {user?.name ? (
            <span className="profile-identity__name">{user.name}</span>
          ) : (
            <span className="profile-badge">{t('profile.guestBadge')}</span>
          )}
          <span className="profile-identity__meta">
            {user?.email ?? t('profile.noEmail')}
          </span>
          {joinedAt && (
            <span className="profile-identity__meta">
              {t('profile.joined', { date: joinedAt })}
            </span>
          )}
          {providers.length > 0 && (
            <ul className="profile-chips">
              {providers.map((provider) => (
                <li
                  key={provider.id}
                  className={`profile-chip${
                    linkedProviderIds.has(provider.id) ? ' profile-chip--linked' : ''
                  }`}
                  title={
                    linkedProviderIds.has(provider.id) ? t('profile.providerConnected') : undefined
                  }
                >
                  {provider.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <dl className="profile-stats">
        <div className="profile-stat">
          <dt className="profile-stat__label">{t('profile.statDocuments')}</dt>
          <dd className="profile-stat__value">{documents.length}</dd>
        </div>
        <div className="profile-stat">
          <dt className="profile-stat__label">{t('profile.statVersions')}</dt>
          <dd className="profile-stat__value">
            {documents.reduce((sum, document) => sum + document.versionCount, 0)}
          </dd>
        </div>
        <div className="profile-stat">
          <dt className="profile-stat__label">{t('profile.statStored')}</dt>
          <dd className="profile-stat__value">
            {formatBytes(documents.reduce((sum, document) => sum + document.sizeInBytes, 0))}
          </dd>
        </div>
        <div className="profile-stat">
          <dt className="profile-stat__label">{t('profile.statLastEdited')}</dt>
          <dd className="profile-stat__value">
            {lastEdited ? (formatRelativeTime(lastEdited, language) ?? t('profile.statNone')) : t('profile.statNone')}
          </dd>
        </div>
        <div className="profile-stat">
          <dt className="profile-stat__label">{t('profile.statDrafts')}</dt>
          <dd className="profile-stat__value">{recoveryQuery.data?.length ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}
