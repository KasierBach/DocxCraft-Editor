import { useState, type FormEvent } from 'react';

import { loginWithPassphrase } from '../../lib/documentApi';
import { useTranslation } from '../../i18n';

type LoginScreenProps = {
  onAuthenticated: () => void;
  onBack?: () => void;
};

export function LoginScreen({ onAuthenticated, onBack }: LoginScreenProps) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passphrase || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await loginWithPassphrase(passphrase);
      onAuthenticated();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('auth.loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="login-card__eyebrow">{t('auth.welcomeBack')}</span>
        <h1 className="login-card__title">{t('auth.signInTitle')}</h1>
        <p className="login-card__copy">{t('auth.signInCopy')}</p>

        {onBack && (
          <button type="button" className="login-card__back" onClick={onBack}>
            {t('common.back')}
          </button>
        )}

        <input
          type="password"
          className="login-card__input"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder={t('auth.passphrase')}
          aria-label={t('auth.passphrase')}
          autoComplete="current-password"
          autoFocus
          disabled={isSubmitting}
        />

        {error && (
          <p className="login-card__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="action-button action-button--primary login-card__submit"
          disabled={isSubmitting || !passphrase}
        >
          {isSubmitting ? t('auth.unlocking') : t('auth.unlock')}
        </button>

        <p className="login-card__hint">
          {t('auth.lostPassphrasePrefix')}
          <code>data/auth.json</code>
          {t('auth.lostPassphraseSuffix')}
        </p>
      </form>
    </main>
  );
}
