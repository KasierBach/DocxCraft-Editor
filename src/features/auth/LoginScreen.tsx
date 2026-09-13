import { useState, type FormEvent } from 'react';

import { loginWithPassphrase } from '../../lib/documentApi';

type LoginScreenProps = {
  onAuthenticated: () => void;
  onBack?: () => void;
};

export function LoginScreen({ onAuthenticated, onBack }: LoginScreenProps) {
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
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="login-card__eyebrow">Welcome back</span>
        <h1 className="login-card__title">Sign in</h1>
        <p className="login-card__copy">
          Enter the passphrase you set for this server to open your workspace.
        </p>

        {onBack && (
          <button type="button" className="login-card__back" onClick={onBack}>
            ← Back
          </button>
        )}

        <input
          type="password"
          className="login-card__input"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="Passphrase"
          aria-label="Passphrase"
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
          {isSubmitting ? 'Unlocking...' : 'Unlock'}
        </button>

        <p className="login-card__hint">
          Lost your passphrase? Reset it on the server by deleting{' '}
          <code>data/auth.json</code>, then set a new one.
        </p>
      </form>
    </main>
  );
}
