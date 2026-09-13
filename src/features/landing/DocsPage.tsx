import { CopyableCommand } from '../../components/ui/CopyableCommand';
import { useTranslation } from '../../i18n';

type DocsPageProps = {
  onBack: () => void;
};

const CONFIG_VARIABLES = [
  { name: 'PORT', fallback: '4175', descriptionKey: 'docs.config.variables.port' },
  { name: 'HOST', fallback: '127.0.0.1', descriptionKey: 'docs.config.variables.host' },
  { name: 'DATA_DIR', fallback: './data/documents', descriptionKey: 'docs.config.variables.dataDir' },
  { name: 'AUTH_MODE', fallback: 'off', descriptionKey: 'docs.config.variables.authMode' },
  { name: 'AUTH_PASSPHRASE_HASH', fallback: '—', descriptionKey: 'docs.config.variables.authPassphraseHash' },
  { name: 'AUTH_PASSPHRASE', fallback: '—', descriptionKey: 'docs.config.variables.authPassphrase' },
  { name: 'AUTH_STATE_FILE', fallback: '—', descriptionKey: 'docs.config.variables.authStateFile' },
  { name: 'CORS_ORIGIN', fallback: 'off', descriptionKey: 'docs.config.variables.corsOrigin' },
  { name: 'LOG_LEVEL', fallback: 'info', descriptionKey: 'docs.config.variables.logLevel' },
];

const SHORTCUTS = [
  { keys: 'Ctrl + S', actionKey: 'docs.shortcuts.actions.save' },
  { keys: 'Ctrl + Shift + S', actionKey: 'docs.shortcuts.actions.saveAs' },
  { keys: 'Ctrl + O', actionKey: 'docs.shortcuts.actions.open' },
  { keys: 'Ctrl + P', actionKey: 'docs.shortcuts.actions.palette' },
  { keys: 'Ctrl + /', actionKey: 'docs.shortcuts.actions.help' },
  { keys: 'Ctrl + \\', actionKey: 'docs.shortcuts.actions.outline' },
  { keys: 'Ctrl + I', actionKey: 'docs.shortcuts.actions.details' },
];

const HARDENING_KEYS = [
  'docs.security.items.uploads',
  'docs.security.items.rateLimit',
  'docs.security.items.headers',
  'docs.security.items.concurrency',
];

export function DocsPage({ onBack }: DocsPageProps) {
  const { t } = useTranslation();

  return (
    <main className="policy-page">
      <article className="policy-card policy-card--docs">
        <span className="login-card__eyebrow">{t('docs.eyebrow')}</span>
        <h1 className="policy-card__title">{t('docs.title')}</h1>
        <p className="policy-card__meta">{t('docs.intro')}</p>

        <section>
          <h2>{t('docs.quickStart.heading')}</h2>
          <p>
            <strong>{t('docs.quickStart.dockerLead')}</strong>{' '}
            {t('docs.quickStart.dockerCopy')}
          </p>
          <CopyableCommand
            code={
              'docker run -d -p 4175:4175 \\\n  -e AUTH_MODE=claim \\\n  -v docxcraft-data:/app/data \\\n  ghcr.io/kasierbach/docxcraft-editor'
            }
          />
          <p>
            <strong>{t('docs.quickStart.localLead')}</strong> {t('docs.quickStart.localCopy')}
          </p>
          <CopyableCommand
            code={
              'git clone https://github.com/KasierBach/DocxCraft-Editor\ncd DocxCraft-Editor\nnpm install\nnpm run dev'
            }
          />
        </section>

        <section>
          <h2>{t('docs.config.heading')}</h2>
          <p>{t('docs.config.intro')}</p>
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">{t('docs.config.columns.variable')}</th>
                <th scope="col">{t('docs.config.columns.default')}</th>
                <th scope="col">{t('docs.config.columns.purpose')}</th>
              </tr>
            </thead>
            <tbody>
              {CONFIG_VARIABLES.map((variable) => (
                <tr key={variable.name}>
                  <td>
                    <code>{variable.name}</code>
                  </td>
                  <td>
                    <code>{variable.fallback}</code>
                  </td>
                  <td>{t(variable.descriptionKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>{t('docs.shortcuts.heading')}</h2>
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">{t('docs.shortcuts.columns.shortcut')}</th>
                <th scope="col">{t('docs.shortcuts.columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((shortcut) => (
                <tr key={shortcut.keys}>
                  <td>
                    <code>{shortcut.keys}</code>
                  </td>
                  <td>{t(shortcut.actionKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>{t('docs.gettingHelp.heading')}</h2>
          <p>
            {t('docs.gettingHelp.bodyPrefix')}
            <strong>{t('docs.gettingHelp.moreActions')}</strong>
            {t('docs.gettingHelp.bodySuffix')}
          </p>
        </section>

        <section>
          <h2>{t('docs.security.heading')}</h2>
          <ul>
            {HARDENING_KEYS.map((itemKey) => (
              <li key={itemKey}>{t(itemKey)}</li>
            ))}
          </ul>
          <p>
            {t('docs.security.readmePrefix')}
            <a
              className="policy-link"
              href="https://github.com/KasierBach/DocxCraft-Editor#readme"
              target="_blank"
              rel="noreferrer"
            >
              {t('docs.security.readmeLink')}
            </a>
            {t('docs.security.readmeSuffix')}
          </p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          {t('docs.back')}
        </button>
      </article>
    </main>
  );
}
