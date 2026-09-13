type ChangelogPageProps = {
  onBack: () => void;
};

const RELEASES = [
  {
    version: 'v0.1.0',
    label: 'First public release',
    groups: [
      {
        name: 'Features',
        items: [
          'Native .docx editing with anchor navigation and page map',
          'Document library with version history and restore',
          'Crash recovery via IndexedDB autosave',
          'Command palette, deep links, and full keyboard control',
          'Responsive layout from desktop to phone with drawer sidebars',
          'Dark mode following the system preference',
        ],
      },
      {
        name: 'Security',
        items: [
          'Passphrase auth with first-run instance claiming',
          'Zip-bomb-hardened upload validation',
          'Content-Security-Policy and hardened response headers',
          'Rate limiting on API and login routes',
        ],
      },
      {
        name: 'Deploy',
        items: [
          'One-command Docker image with automatic HTTPS',
          'Published to GitHub Container Registry with SBOM attestations',
        ],
      },
    ],
  },
];

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  return (
    <main className="policy-page">
      <article className="policy-card policy-card--docs">
        <span className="login-card__eyebrow">Release history</span>
        <h1 className="policy-card__title">Changelog</h1>
        <p className="policy-card__meta">
          Every release, documented. The full commit history lives on GitHub.
        </p>

        <div className="landing-changelog">
          {RELEASES.map((release) => (
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
            Older history and unreleased work:{' '}
            <a
              className="policy-link"
              href="https://github.com/KasierBach/DocxCraft-Editor/commits/main"
              target="_blank"
              rel="noreferrer"
            >
              browse the commits
            </a>
            .
          </p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          ← Back to home
        </button>
      </article>
    </main>
  );
}
