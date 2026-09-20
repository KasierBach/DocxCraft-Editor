import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '../../../i18n';
import { formatDateTime } from '../../../lib/format';
import { listWorkspaceNotifications, markWorkspaceNotificationsRead } from '../../../lib/workspaceApi';

const NOTIFICATIONS_KEY = ['workspace', 'notifications'];

export function NotificationsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: listWorkspaceNotifications });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => markWorkspaceNotificationsRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
  const notifications = query.data ?? [];

  if (query.isLoading) return <p className="panel-copy">{t('profile.loading')}</p>;
  if (query.isError) {
    return (
      <div className="profile-state" role="alert">
        <p className="panel-copy">{t('profile.notificationsUnavailable')}</p>
        <button type="button" className="action-button" onClick={() => void query.refetch()}>
          {t('profile.retry')}
        </button>
      </div>
    );
  }

  const unread = notifications.filter((notification) => !notification.readAt);
  return (
    <section className="profile-section">
      <div className="profile-section__header">
        <div>
          <h2>{t('profile.notificationsTitle')}</h2>
          <p className="panel-copy">{t('profile.notificationsCopy')}</p>
        </div>
        {unread.length > 0 && (
          <button type="button" className="action-button" disabled={markRead.isPending} onClick={() => markRead.mutate()}>
            {t('profile.markAllRead')}
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="panel-copy">{t('profile.notificationsEmpty')}</p>
      ) : (
        <ul className="profile-list">
          {notifications.map((notification) => (
            <li key={notification.id} className="profile-list__row">
              <div className="profile-list__main">
                <span className="profile-list__name">{notification.type}</span>
                <span className="profile-list__meta">{formatDateTime(notification.createdAt)}</span>
              </div>
              {!notification.readAt && <span className="profile-chip">{t('profile.unread')}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
