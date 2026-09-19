import type { MessageVars } from '../../i18n';
import type { ActivityEvent } from '../../lib/accountApi';

type Translator = (key: string, vars?: MessageVars) => string;

/**
 * Maps an activity row to copy. `action` is deliberately a plain string, so
 * unknown or malformed rows fall back rather than throw. Rename detail is only
 * used when both names are present; older rows without metadata stay readable.
 */
export function activityLabel(event: ActivityEvent, t: Translator): string {
  switch (event.action) {
    case 'document.create':
      return t('profile.activityCreated');
    case 'document.update':
      return t('profile.activitySaved');
    case 'document.rename': {
      const from = event.metadata?.previousName;
      const to = event.metadata?.newName;
      return typeof from === 'string' && typeof to === 'string' && from && to
        ? t('profile.activityRenamed', { from, to })
        : t('profile.activityRenamedUnknown');
    }
    case 'document.delete':
      return t('profile.activityDeleted');
    case 'document.restore':
      return t('profile.activityRestored');
    case 'document.purge':
      return t('profile.activityPurged');
    case 'document.duplicate':
      return t('profile.activityDuplicated');
    case 'account.sign_in':
      return t('profile.activitySignedIn');
    case 'account.export':
      return t('profile.activityExported');
    case 'account.delete':
      return t('profile.activityAccountDeleted');
    case 'account.profile_update':
      return t('profile.activityProfileUpdated');
    case 'account.provider_disconnect':
      return t('profile.activityProviderDisconnected');
    default:
      return t('profile.activityUnknown');
  }
}
