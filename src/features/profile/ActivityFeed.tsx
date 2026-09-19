import { useTranslation } from '../../i18n';
import { formatDateTime } from '../../lib/format';
import { activityLabel } from './activityLabel';
import { useAccountActivity } from './useAccountActivity';

/** The caller's activity, day-grouped, newest first. */
export function ActivityFeed() {
  const { t } = useTranslation();
  const activity = useAccountActivity();

  return (
    <section className="profile-section">
      <h2>{t('profile.recentActivity')}</h2>

      {activity.isLoading ? (
        <p className="panel-copy">{t('profile.loading')}</p>
      ) : activity.isError ? (
        <div className="profile-state" role="alert">
          <p className="panel-copy">{t('profile.activityFailed')}</p>
          <button type="button" className="action-button" onClick={activity.retry}>
            {t('profile.retry')}
          </button>
        </div>
      ) : activity.events.length === 0 ? (
        <p className="panel-copy">{t('profile.noActivity')}</p>
      ) : (
        activity.groups.map((group) => (
          <div key={group.day}>
            <h3 className="profile-list__meta">{group.day}</h3>
            <ul className="profile-list">
              {group.events.map((event) => (
                <li key={event.id} className="profile-list__row">
                  <span className="profile-list__name">{activityLabel(event, t)}</span>
                  <span className="profile-list__meta">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {activity.hasMore && (
        <div className="profile-actions">
          <button type="button" className="action-button" onClick={activity.fetchMore}>
            {t('profile.loadMore')}
          </button>
        </div>
      )}
    </section>
  );
}
