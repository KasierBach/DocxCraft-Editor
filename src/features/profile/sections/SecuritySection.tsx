import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '../../../i18n';
import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from '../../../lib/accountApi';
import { formatDateTime } from '../../../lib/format';
import { ActivityFeed } from '../ActivityFeed';

const SESSIONS_KEY = ['account', 'sessions'];

/** Signed-in devices with revoke controls, then the caller's recent activity. */
export function SecuritySection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({ queryKey: SESSIONS_KEY, queryFn: listSessions });

  const refreshSessions = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    // A session that is already gone (404) is not an error: refresh the list.
    onSettled: () => void refreshSessions(),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => void refreshSessions(),
  });

  const sessions = sessionsQuery.data ?? [];
  const hasOtherSessions = sessions.some((session) => !session.isCurrent);

  return (
    <div className="profile-section-stack">
      <section className="profile-section">
        <h2>{t('profile.devices')}</h2>

        {sessionsQuery.isLoading ? (
          <p className="panel-copy">{t('profile.loading')}</p>
        ) : sessionsQuery.isError ? (
          <div className="profile-state" role="alert">
            <p className="panel-copy">{t('profile.loadFailed')}</p>
            <button
              type="button"
              className="action-button"
              onClick={() => void sessionsQuery.refetch()}
            >
              {t('profile.retry')}
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="panel-copy">{t('profile.noSessions')}</p>
        ) : (
          <ul className="profile-list">
            {sessions.map((session) => (
              <li key={session.id} className="profile-list__row">
                <div className="profile-list__main">
                  <span className="profile-list__name">
                    {session.device}
                    {session.isCurrent && (
                      <span className="profile-chip">{t('profile.thisDevice')}</span>
                    )}
                  </span>
                  <span className="profile-list__meta">
                    {session.ip ?? t('profile.unknownIp')}
                  </span>
                  <span className="profile-list__meta">
                    {t('profile.deviceStarted')}: {formatDateTime(session.createdAt)} ·{' '}
                    {t('profile.deviceExpires')}: {formatDateTime(session.expiresAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="action-button"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(session.id)}
                >
                  {revokeMutation.isPending ? t('profile.signingOut') : t('profile.signOut')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="profile-actions">
          <button
            type="button"
            className="action-button"
            disabled={!hasOtherSessions || revokeOthersMutation.isPending}
            onClick={() => revokeOthersMutation.mutate()}
          >
            {t('profile.signOutEverywhere')}
          </button>
        </div>
      </section>

      <ActivityFeed />
    </div>
  );
}
