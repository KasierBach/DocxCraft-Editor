type TermsOfUseProps = {
  onBack: () => void;
};

const LAST_UPDATED = '2026-09-12';

export function TermsOfUse({ onBack }: TermsOfUseProps) {
  return (
    <main className="policy-page">
      <article className="policy-card">
        <span className="login-card__eyebrow">Terms</span>
        <h1 className="policy-card__title">Terms of Use</h1>
        <p className="policy-card__meta">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>The software</h2>
          <p>
            This editor is open-source software licensed under the MIT License and is
            provided “as is”, without warranty of any kind. The authors are not liable
            for any damages or data loss arising from its use.
          </p>
        </section>

        <section>
          <h2>Your account</h2>
          <p>
            Access is protected by a passphrase. You are responsible for keeping it
            secret and for all activity performed under your session. Because the
            passphrase is stored only as a hash, it cannot be recovered or reset by
            the operator without resetting the instance.
          </p>
        </section>

        <section>
          <h2>Your documents</h2>
          <p>
            You retain all rights to the documents you store here. The software makes
            no claim of ownership and uses no document content for any purpose beyond
            saving, versioning, and serving it back to you.
          </p>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <p>
            Do not use this instance to store or distribute unlawful content, or to
            attack, overload, or probe the service. The operator may revoke access at
            any time.
          </p>
        </section>

        <section>
          <h2>Availability</h2>
          <p>
            The service is provided on a best-effort basis with no uptime guarantee.
            Keep your own backups of important documents.
          </p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          Back
        </button>
      </article>
    </main>
  );
}
