import { useState, type FormEvent } from 'react';

import { claimInstanceWithPassphrase } from '../lib/documentApi';

const MIN_PASSPHRASE_LENGTH = 8;

type SetupScreenProps = {
  onClaimed: () => void;
};

export function SetupScreen({ onClaimed }: SetupScreenProps) {
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
      setError(setupError instanceof Error ? setupError.message : 'Setup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="login-card__eyebrow">One-time setup · first visit</span>
        <h1 className="login-card__title">Set your passphrase</h1>
        <p className="login-card__copy">
          This editor is private to your server — you are its first user. Choose a
          passphrase to lock it; you will use it to sign in from now on. It is stored
          encrypted on this server and can never be recovered, so pick something you
          will remember.
        </p>

        <input
          type="password"
          className="login-card__input"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder={`Passphrase (at least ${MIN_PASSPHRASE_LENGTH} characters)`}
          aria-label="Passphrase"
          autoComplete="new-password"
          autoFocus
          disabled={isSubmitting}
        />

        <input
          type="password"
          className="login-card__input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Repeat passphrase"
          aria-label="Repeat passphrase"
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        {isTooShort && (
          <p className="login-card__hint" role="status">
            Use at least {MIN_PASSPHRASE_LENGTH} characters.
          </p>
        )}
        {doesNotMatch && (
          <p className="login-card__hint" role="status">
            The passphrases do not match.
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
          {isSubmitting ? 'Saving...' : 'Save passphrase and start'}
        </button>
      </form>
    </main>
  );
}
