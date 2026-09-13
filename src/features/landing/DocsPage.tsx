import { CopyableCommand } from '../../components/ui/CopyableCommand';

type DocsPageProps = {
  onBack: () => void;
};

const CONFIG_VARIABLES = [
  { name: 'PORT', fallback: '4175', description: 'HTTP port the server binds to' },
  { name: 'HOST', fallback: '127.0.0.1', description: 'Bind address — keep localhost unless behind TLS' },
  { name: 'DATA_DIR', fallback: './data/documents', description: 'Where documents and versions are stored' },
  { name: 'AUTH_MODE', fallback: 'off', description: 'Set to "claim" so the first visit sets the passphrase' },
  { name: 'AUTH_PASSPHRASE_HASH', fallback: '—', description: 'Pre-seed the passphrase (npm run hash-passphrase)' },
  { name: 'CORS_ORIGIN', fallback: 'off', description: 'Allow browser clients from other origins' },
  { name: 'LOG_LEVEL', fallback: 'info', description: 'Server log level' },
];

const SHORTCUTS = [
  { keys: 'Ctrl + S', action: 'Save the current document' },
  { keys: 'Ctrl + Shift + S', action: 'Save as a new copy' },
  { keys: 'Ctrl + O', action: 'Open a .docx from your computer' },
  { keys: 'Ctrl + P', action: 'Command palette' },
  { keys: 'Ctrl + /', action: 'Keyboard shortcut help' },
  { keys: 'Ctrl + \\', action: 'Toggle the outline sidebar' },
  { keys: 'Ctrl + I', action: 'Toggle the details sidebar' },
];

const HARDENING = [
  'Uploads are validated before decompression: ZIP structure, entry count, path traversal, zip-bomb ratios, and CRC32.',
  'All API routes are rate-limited; login attempts have their own tighter limit.',
  'Strict Content-Security-Policy, X-Frame-Options, and nosniff headers on every response.',
  'Optimistic concurrency: stale saves are rejected with a 409 instead of overwriting.',
];

export function DocsPage({ onBack }: DocsPageProps) {
  return (
    <main className="policy-page">
      <article className="policy-card policy-card--docs">
        <span className="login-card__eyebrow">Documentation</span>
        <h1 className="policy-card__title">Docs</h1>
        <p className="policy-card__meta">
          Everything needed to run, configure, and harden DocxCraft.
        </p>

        <section>
          <h2>Quick start</h2>
          <p>
            <strong>Self-host with Docker.</strong> Documents persist in the named volume;
            open the URL and set your passphrase on first visit.
          </p>
          <CopyableCommand
            code={
              'docker run -d -p 4175:4175 \\\n  -v docxcraft-data:/app/data \\\n  ghcr.io/kasierbach/docxcraft-editor'
            }
          />
          <p>
            <strong>Run it locally.</strong> Node 22.12+ and npm are the only requirements;
            the dev launcher starts the API and editor together.
          </p>
          <CopyableCommand
            code={
              'git clone https://github.com/KasierBach/DocxCraft-Editor\ncd DocxCraft-Editor\nnpm install\nnpm run dev'
            }
          />
        </section>

        <section>
          <h2>Configuration</h2>
          <p>All settings are environment variables with sensible defaults.</p>
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Default</th>
                <th scope="col">Purpose</th>
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
                  <td>{variable.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Keyboard shortcuts</h2>
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Shortcut</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((shortcut) => (
                <tr key={shortcut.keys}>
                  <td>
                    <code>{shortcut.keys}</code>
                  </td>
                  <td>{shortcut.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Security model</h2>
          <ul>
            {HARDENING.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            The full architecture, API reference, and deployment notes live in the{' '}
            <a
              className="policy-link"
              href="https://github.com/KasierBach/DocxCraft-Editor#readme"
              target="_blank"
              rel="noreferrer"
            >
              repository README
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
