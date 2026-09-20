import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '../../../i18n';
import { getAiSettings, updateAiSettings } from '../../../lib/workspaceApi';

export function AiSettingsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['ai-settings'], queryFn: getAiSettings });
  const saveMutation = useMutation({
    mutationFn: updateAiSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ai-settings'] }),
  });

  if (settingsQuery.isLoading) return <p className="panel-copy">{t('profile.loading')}</p>;
  if (settingsQuery.isError || !settingsQuery.data) {
    return <p className="panel-copy">{t('profile.aiUnavailable')}</p>;
  }

  const settings = settingsQuery.data;
  const providers = settings.providers ?? [];
  return (
    <div className="profile-section-stack">
      <section className="profile-section">
        <h2>{t('profile.aiTitle')}</h2>
        <p className="panel-copy">{t('profile.aiCopy')}</p>
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            saveMutation.mutate({
              provider: String(form.get('provider') ?? settings.provider),
              model: String(form.get('model') ?? settings.model),
              baseUrl: String(form.get('baseUrl') ?? settings.baseUrl ?? '') || null,
              enabled: form.get('enabled') === 'on',
            });
          }}
        >
          <label className="profile-form__field">
            <span>{t('profile.aiProvider')}</span>
            <select name="provider" defaultValue={settings.provider}>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
              {providers.length === 0 && <option value={settings.provider}>{settings.provider}</option>}
            </select>
          </label>
          <label className="profile-form__field">
            <span>{t('profile.aiModel')}</span>
            <input name="model" list="ai-model-options" defaultValue={settings.model} required />
            <datalist id="ai-model-options">
              {[...new Set(providers.flatMap((provider) => provider.models))].map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>
          <label className="profile-form__field">
            <span>{t('profile.aiBaseUrl')}</span>
            <input name="baseUrl" type="url" defaultValue={settings.baseUrl ?? ''} placeholder="https://api.openai.com/v1" readOnly />
          </label>
          <label className="profile-form__checkbox">
            <input name="enabled" type="checkbox" defaultChecked={settings.enabled} />
            <span>{t('profile.aiEnabled')}</span>
          </label>
          <p className="profile-section__note">
            {t('profile.aiKeySource', { source: settings.keySource, configured: settings.apiKeyConfigured ? t('profile.yes') : t('profile.no') })}
          </p>
          <button type="submit" className="action-button action-button--primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? t('profile.saving') : t('profile.save')}
          </button>
        </form>
      </section>
      <section className="profile-section">
        <h2>{t('profile.aiProviders')}</h2>
        <div className="profile-ai-grid">
          {providers.map((provider) => (
            <article className="profile-ai-provider" key={provider.id}>
              <strong>{provider.label}</strong>
              <span>{provider.protocol}</span>
              <small>{provider.capabilities.join(' · ')}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="profile-section">
        <h2>{t('profile.aiUsage')}</h2>
        <p className="panel-copy">{t('profile.aiUsageCopy', { used: settings.usage.requests, max: settings.maxRequestsPerHour })}</p>
      </section>
    </div>
  );
}
