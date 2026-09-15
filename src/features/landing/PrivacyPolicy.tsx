import { useTranslation } from '../../i18n';

type PrivacyPolicyProps = {
  onBack: () => void;
};

const LAST_UPDATED = '2026-09-15';

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  const { t } = useTranslation();

  return (
    <main className="policy-page">
      <article className="policy-card">
        <span className="login-card__eyebrow">{t('legal.privacy.eyebrow')}</span>
        <h1 className="policy-card__title">{t('legal.privacy.title')}</h1>
        <p className="policy-card__meta">
          {t('legal.privacy.lastUpdated')} {LAST_UPDATED}
        </p>

        <section>
          <h2>{t('legal.privacy.shortVersion.title')}</h2>
          <p>{t('legal.privacy.shortVersion.body')}</p>
        </section>

        <section>
          <h2>{t('legal.privacy.whatIsStored.title')}</h2>
          <ul>
            <li>
              <strong>{t('legal.privacy.whatIsStored.items.0.label')}</strong>{' '}
              {t('legal.privacy.whatIsStored.items.0.body')}
            </li>
            <li>
              <strong>{t('legal.privacy.whatIsStored.items.1.label')}</strong>{' '}
              {t('legal.privacy.whatIsStored.items.1.body')}
            </li>
            <li>
              <strong>{t('legal.privacy.whatIsStored.items.2.label')}</strong>{' '}
              {t('legal.privacy.whatIsStored.items.2.body')}
            </li>
            <li>
              <strong>{t('legal.privacy.whatIsStored.items.3.label')}</strong>{' '}
              {t('legal.privacy.whatIsStored.items.3.body')}
            </li>
          </ul>
        </section>

        <section>
          <h2>{t('legal.privacy.notCollected.title')}</h2>
          <p>{t('legal.privacy.notCollected.body')}</p>
        </section>

        <section>
          <h2>{t('legal.privacy.sharingDeletion.title')}</h2>
          <p>{t('legal.privacy.sharingDeletion.body')}</p>
        </section>

        <section>
          <h2>{t('legal.privacy.operatorResponsibility.title')}</h2>
          <p>{t('legal.privacy.operatorResponsibility.body')}</p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          {t('legal.privacy.back')}
        </button>
      </article>
    </main>
  );
}
