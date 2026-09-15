import { useState } from 'react';

import { useTranslation } from '../../i18n';
import type { AuthProvider } from '../../lib/documentApi';

const DISMISS_KEY = 'docxcraft:guest-banner-dismissed';

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

type GuestBannerProps = {
  providers: AuthProvider[];
  onSignIn: () => void;
};

/**
 * Nudge for a guest workspace: the session cookie expires, and without an
 * account the documents go with it. Dismissible for the rest of the session.
 */
export function GuestBanner({ providers, onSignIn }: GuestBannerProps) {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(readDismissed);

  if (isDismissed || providers.length === 0) {
    return null;
  }

  const dismiss = () => {
    setIsDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage can be unavailable; dismissing in memory is enough.
    }
  };

  return (
    <aside className="guest-banner" aria-label={t('auth.guestBannerTitle')}>
      <span className="guest-banner__text">
        <strong>{t('auth.guestBannerTitle')}</strong> {t('auth.guestBannerCopy')}
      </span>
      <button type="button" className="action-button guest-banner__action" onClick={onSignIn}>
        {t('auth.signInAction')}
      </button>
      <button
        type="button"
        className="guest-banner__dismiss"
        onClick={dismiss}
        aria-label={t('auth.dismiss')}
      >
        ×
      </button>
    </aside>
  );
}
