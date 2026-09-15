import { useTranslation } from '../../i18n';

type ChangelogPageProps = {
  onBack: () => void;
};

type Translate = (key: string) => string;

function buildReleases(t: Translate) {
  return [
    {
      version: 'v0.2.0',
      label: t('changelog.releases.v020.label'),
      groups: [
        {
          name: t('changelog.releases.v020.groups.added.name'),
          items: [t('changelog.releases.v020.groups.added.items.menuLinks')],
        },
        {
          name: t('changelog.releases.v020.groups.changed.name'),
          items: [
            t('changelog.releases.v020.groups.changed.items.reorganized'),
            t('changelog.releases.v020.groups.changed.items.dockerClaim'),
          ],
        },
        {
          name: t('changelog.releases.v020.groups.internal.name'),
          items: [t('changelog.releases.v020.groups.internal.items.smokeTest')],
        },
      ],
    },
    {
      version: 'v0.1.0',
      label: t('changelog.releases.v010.label'),
      groups: [
        {
          name: t('changelog.releases.v010.groups.features.name'),
          items: [
            t('changelog.releases.v010.groups.features.items.nativeEditing'),
            t('changelog.releases.v010.groups.features.items.library'),
            t('changelog.releases.v010.groups.features.items.crashRecovery'),
            t('changelog.releases.v010.groups.features.items.keyboard'),
            t('changelog.releases.v010.groups.features.items.responsive'),
            t('changelog.releases.v010.groups.features.items.darkMode'),
          ],
        },
        {
          name: t('changelog.releases.v010.groups.security.name'),
          items: [
            t('changelog.releases.v010.groups.security.items.passphraseAuth'),
            t('changelog.releases.v010.groups.security.items.zipBomb'),
            t('changelog.releases.v010.groups.security.items.csp'),
            t('changelog.releases.v010.groups.security.items.rateLimit'),
          ],
        },
        {
          name: t('changelog.releases.v010.groups.deploy.name'),
          items: [
            t('changelog.releases.v010.groups.deploy.items.docker'),
            t('changelog.releases.v010.groups.deploy.items.ghcr'),
          ],
        },
      ],
    },
  ];
}

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  const { t } = useTranslation();
  const releases = buildReleases(t);

  return (
    <main className="policy-page">
      <article className="policy-card policy-card--docs">
        <span className="login-card__eyebrow">{t('changelog.eyebrow')}</span>
        <h1 className="policy-card__title">{t('changelog.title')}</h1>
        <p className="policy-card__meta">{t('changelog.intro')}</p>

        <div className="landing-changelog">
          {releases.map((release) => (
            <article key={release.version} className="landing-release">
              <header className="landing-release__header">
                <span className="landing-release__version">{release.version}</span>
                <span className="landing-release__label">{release.label}</span>
              </header>
              <div className="landing-release__groups">
                {release.groups.map((group) => (
                  <div key={group.name} className="landing-release__group">
                    <h3 className="landing-release__group-name">{group.name}</h3>
                    <ul className="landing-release__items">
                      {group.items.map((item) => (
                        <li key={item} className="landing-release__item">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <section>
          <p>
            {t('changelog.older.prefix')}
            <a
              className="policy-link"
              href="https://github.com/KasierBach/DocxCraft-Editor/commits/main"
              target="_blank"
              rel="noreferrer"
            >
              {t('changelog.older.browseCommits')}
            </a>
            .
          </p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          {t('changelog.back')}
        </button>
      </article>
    </main>
  );
}
