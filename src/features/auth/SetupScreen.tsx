import { useState, type FormEvent } from 'react';

import { claimInstanceWithPassphrase } from '../../lib/documentApi';
import { useTranslation } from '../../i18n';

const MIN_PASSPHRASE_LENGTH = 8;

type SetupScreenProps = {
  onClaimed: () => void;
};

export function SetupScreen({ onClaimed }: SetupScreenProps) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTooShort = passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE_LENGTH;
  const doesNotMatch =
    confirmation.length > 0 && passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase !== confirmation;
  const canSubmit =
    !isSubmitting &&
    passphrase.length >= MIN_PASSPHRASE_LENGTH &&
    passphrase === confirmation;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await claimInstanceWithPassphrase(passphrase);
      onClaimed();
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : t('auth.setupFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="login-card__eyebrow">{t('auth.setupEyebrow')}</span>
        <h1 className="login-card__title">{t('auth.setupTitle')}</h1>
        <p className="login-card__copy">{t('auth.setupCopy')}</p>

        <input
          type="password"
          className="login-card__input"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder={t('auth.passphraseMinPlaceholder', { min: MIN_PASSPHRASE_LENGTH })}
          aria-label={t('auth.passphrase')}
          autoComplete="new-password"
          autoFocus
          disabled={isSubmitting}
        />

        <input
          type="password"
          className="login-card__input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={t('auth.repeatPassphrase')}
          aria-label={t('auth.repeatPassphrase')}
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        {isTooShort && (
          <p className="login-card__hint" role="status">
            {t('auth.useAtLeast', { min: MIN_PASSPHRASE_LENGTH })}
          </p>
        )}
        {doesNotMatch && (
          <p className="login-card__hint" role="status">
            {t('auth.passphrasesDoNotMatch')}
          </p>
        )}
        {error && (
          <p className="login-card__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="action-button action-button--primary login-card__submit"
          disabled={!canSubmit}
        >
          {isSubmitting ? t('auth.saving') : t('auth.savePassphraseAndStart')}
        </button>
      </form>
    </main>
  );
}
