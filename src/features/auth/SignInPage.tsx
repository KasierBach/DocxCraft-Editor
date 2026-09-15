import { useTranslation } from '../../i18n';
import type { AuthProvider } from '../../lib/documentApi';

type SignInPageProps = {
  providers: AuthProvider[];
  onContinueAsGuest: () => void;
};

/**
 * Hosted sign-in / sign-up. With OAuth the same consent creates the account on
 * first use, so there is one page and the wording is "Continue with…".
 */
export function SignInPage({ providers, onContinueAsGuest }: SignInPageProps) {
  const { t } = useTranslation();

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="signin-title">
        <span className="login-card__eyebrow">{t('auth.hostedEyebrow')}</span>
        <h1 className="login-card__title" id="signin-title">
          {t('auth.hostedTitle')}
        </h1>
        <p className="login-card__copy">{t('auth.hostedCopy')}</p>

        <div className="signin-providers">
          {providers.map((provider) => (
            <a
              key={provider.id}
              className="action-button signin-providers__button"
              href={`/api/auth/${provider.id}/start`}
            >
              {t('auth.continueWith', { provider: provider.label })}
            </a>
          ))}
        </div>

        <p className="login-card__hint">{t('auth.guestHint')}</p>
        <button type="button" className="action-button" onClick={onContinueAsGuest}>
          {t('auth.continueAsGuest')}
        </button>
      </section>
    </main>
  );
}
