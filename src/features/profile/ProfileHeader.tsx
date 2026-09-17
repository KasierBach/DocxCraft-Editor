import { useQuery } from '@tanstack/react-query';

import { useTranslation } from '../../i18n';
import { readAuthSession, type SavedDocumentSummary } from '../../lib/documentApi';
import { formatBytes } from '../../lib/format';
import { readRecoverySnapshot } from '../../lib/recoveryStore';
import { useAuthGate } from '../auth/AuthGateContext';

type ProfileHeaderProps = {
  documents: SavedDocumentSummary[];
};

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

function formatRelative(isoDate: string, language: string) {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return null;

  const elapsed = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= size) {
      return formatter.format(Math.round(elapsed / size), unit);
    }
  }

  return formatter.format(0, 'second');
}

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
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: readAuthSession });
  const recoveryQuery = useQuery({ queryKey: ['account', 'recovery'], queryFn: readRecoverySnapshot });

  const user = sessionQuery.data?.user;
  const lastEdited = newestUpdate(documents);

  return (
    <section className="profile-header">
      <div className="profile-header__identity">
        <div className="profile-avatar" aria-hidden="true">
          {user?.avatarUrl ? (
            <img className="profile-avatar__image" src={user.avatarUrl} alt="" />
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
          {providers.length > 0 && (
            <ul className="profile-chips">
              {providers.map((provider) => (
                <li key={provider.id} className="profile-chip">
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
            {lastEdited ? (formatRelative(lastEdited, language) ?? t('profile.statNone')) : t('profile.statNone')}
          </dd>
        </div>
        <div className="profile-stat">
          <dt className="profile-stat__label">{t('profile.statDrafts')}</dt>
          <dd className="profile-stat__value">{recoveryQuery.data ? 1 : 0}</dd>
        </div>
      </dl>
    </section>
  );
}
