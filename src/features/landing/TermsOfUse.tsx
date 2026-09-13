import { useTranslation } from '../../i18n';

type TermsOfUseProps = {
  onBack: () => void;
};

const LAST_UPDATED = '2026-09-12';

export function TermsOfUse({ onBack }: TermsOfUseProps) {
  const { t } = useTranslation();

  return (
    <main className="policy-page">
      <article className="policy-card">
        <span className="login-card__eyebrow">{t('legal.terms.eyebrow')}</span>
        <h1 className="policy-card__title">{t('legal.terms.title')}</h1>
        <p className="policy-card__meta">
          {t('legal.terms.lastUpdated')} {LAST_UPDATED}
        </p>

        <section>
          <h2>{t('legal.terms.software.title')}</h2>
          <p>{t('legal.terms.software.body')}</p>
        </section>

        <section>
          <h2>{t('legal.terms.account.title')}</h2>
          <p>{t('legal.terms.account.body')}</p>
        </section>

        <section>
          <h2>{t('legal.terms.documents.title')}</h2>
          <p>{t('legal.terms.documents.body')}</p>
        </section>

        <section>
          <h2>{t('legal.terms.acceptableUse.title')}</h2>
          <p>{t('legal.terms.acceptableUse.body')}</p>
        </section>

        <section>
          <h2>{t('legal.terms.availability.title')}</h2>
          <p>{t('legal.terms.availability.body')}</p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          {t('legal.terms.back')}
        </button>
      </article>
    </main>
  );
}
