import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme, type Theme } from '../../../hooks/useTheme';
import { useTranslation, type Language } from '../../../i18n';
import { updateDisplayName } from '../../../lib/accountApi';
import { readAuthSession } from '../../../lib/documentApi';
import { useAppStore, type EditorMode } from '../../../store/appStore';
import { useAuthGate } from '../../auth/AuthGateContext';

const MODE_OPTIONS: Array<{ value: EditorMode; labelKey: string }> = [
  { value: 'editing', labelKey: 'profile.modeEditing' },
  { value: 'suggesting', labelKey: 'profile.modeSuggesting' },
  { value: 'viewing', labelKey: 'profile.modeViewing' },
];

/** Identity, sign-in providers, and the client-side editor preferences. */
export function ProfileSection() {
  const { t, language, setLanguage } = useTranslation();
  const { isAnonymous, providers } = useAuthGate();
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: readAuthSession });
  const { theme, setTheme } = useTheme();
  const editorMode = useAppStore((state) => state.editorMode);
  const setEditorMode = useAppStore((state) => state.setEditorMode);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const user = sessionQuery.data?.user;
  const isSignedIn = !isAnonymous;

  const nameMutation = useMutation({
    mutationFn: (displayName: string) => updateDisplayName(displayName),
    onSuccess: () => {
      setNameError(null);
      void queryClient.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (error: Error) => setNameError(error.message),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('displayName') ?? '').trim();

    if (!value) {
      setNameError(t('profile.nameRequired'));
      return;
    }

    nameMutation.mutate(value);
  };

  const handleCopy = async () => {
    if (!user?.id || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(user.id);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <div className="profile-section-stack">
      <section className="profile-section">
        <h2>{t('profile.sectionProfile')}</h2>

        {!isSignedIn ? (
          <>
            <p className="panel-copy">{t('profile.guestPrompt')}</p>
            {providers.length > 0 && (
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
            )}
          </>
        ) : sessionQuery.isPending ? (
          <p className="panel-copy">{t('profile.loading')}</p>
        ) : (
          <form className="profile-form" onSubmit={handleSubmit}>
            <label className="profile-field">
              <span className="profile-field__label">{t('profile.displayName')}</span>
              <input
                type="text"
                name="displayName"
                className="filter-input"
                defaultValue={user?.name ?? ''}
                placeholder={t('profile.displayNamePlaceholder')}
              />
            </label>
            <div className="profile-actions">
              <button type="submit" className="action-button" disabled={nameMutation.isPending}>
                {nameMutation.isPending ? t('profile.saving') : t('profile.save')}
              </button>
              {nameError ? (
                <span className="profile-error" role="alert">
                  {nameError}
                </span>
              ) : nameMutation.isSuccess ? (
                <span className="profile-status" role="status">
                  {t('profile.nameSaved')}
                </span>
              ) : null}
            </div>
          </form>
        )}

        <dl className="profile-fields">
          <div className="profile-field-row">
            <dt>{t('profile.email')}</dt>
            <dd>{user?.email ?? t('profile.noEmail')}</dd>
          </div>
          <div className="profile-field-row">
            <dt>{t('profile.accountId')}</dt>
            <dd>
              <code className="profile-code">{user?.id ?? t('profile.statNone')}</code>
              {user?.id && (
                <button
                  type="button"
                  className="action-button"
                  onClick={() => void handleCopy()}
                >
                  {isCopied ? t('profile.copied') : t('profile.copy')}
                </button>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {isSignedIn && providers.length > 0 && (
        <section className="profile-section">
          <h3>{t('profile.providers')}</h3>
          <div className="profile-actions">
            {providers.map((provider) => (
              <a
                key={provider.id}
                className="action-button"
                href={`/api/auth/${provider.id}/start`}
              >
                {t('profile.connectProvider', { provider: provider.label })}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="profile-section">
        <h3>{t('profile.preferences')}</h3>
        <div className="profile-preferences">
          <label className="profile-field">
            <span className="profile-field__label">{t('profile.theme')}</span>
            <select
              className="filter-select"
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              <option value="light">{t('profile.themeLight')}</option>
              <option value="dark">{t('profile.themeDark')}</option>
            </select>
          </label>

          <label className="profile-field">
            <span className="profile-field__label">{t('profile.language')}</span>
            <select
              className="filter-select"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              <option value="en">{t('profile.languageEnglish')}</option>
              <option value="vi">{t('profile.languageVietnamese')}</option>
            </select>
          </label>

          <label className="profile-field">
            <span className="profile-field__label">{t('profile.editorMode')}</span>
            <select
              className="filter-select"
              value={editorMode}
              onChange={(event) => setEditorMode(event.target.value as EditorMode)}
            >
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
