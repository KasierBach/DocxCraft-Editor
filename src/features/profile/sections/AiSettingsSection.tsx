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
              model: String(form.get('model') ?? settings.model),
              baseUrl: String(form.get('baseUrl') ?? settings.baseUrl ?? '') || null,
              enabled: form.get('enabled') === 'on',
            });
          }}
        >
          <label className="profile-form__field">
            <span>{t('profile.aiProvider')}</span>
            <input value={settings.provider} readOnly />
          </label>
          <label className="profile-form__field">
            <span>{t('profile.aiModel')}</span>
            <input name="model" defaultValue={settings.model} required />
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
        <h2>{t('profile.aiUsage')}</h2>
        <p className="panel-copy">{t('profile.aiUsageCopy', { used: settings.usage.requests, max: settings.maxRequestsPerHour })}</p>
      </section>
    </div>
  );
}
