type PrivacyPolicyProps = {
  onBack: () => void;
};

const LAST_UPDATED = '2026-09-12';

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <main className="policy-page">
      <article className="policy-card">
        <span className="login-card__eyebrow">Privacy</span>
        <h1 className="policy-card__title">Privacy Policy</h1>
        <p className="policy-card__meta">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>The short version</h2>
          <p>
            This editor stores your documents on this server and collects nothing else.
            There is no analytics, no telemetry, no advertising, and no third-party
            tracking. The operator of this server is the data controller for the
            documents you store here.
          </p>
        </section>

        <section>
          <h2>What is stored</h2>
          <ul>
            <li>
              <strong>Documents.</strong> The .docx files you open or save, and up to 100
              version snapshots per document, kept in this server’s local storage.
            </li>
            <li>
              <strong>Account security data.</strong> A salted, hashed passphrase
              (scrypt). The passphrase itself is never stored in readable form and
              cannot be recovered.
            </li>
            <li>
              <strong>Session cookie.</strong> A single HTTP-only cookie that keeps you
              signed in for up to 7 days. It contains a signed expiry timestamp and no
              personal data.
            </li>
            <li>
              <strong>Recovery drafts.</strong> Unsaved edits are backed up in your own
              browser (IndexedDB/localStorage) and never leave your device.
            </li>
          </ul>
        </section>

        <section>
          <h2>What is not collected</h2>
          <p>
            No names, email addresses, phone numbers, payment details, location data,
            or behavioural analytics. The server logs contain technical request
            metadata (timestamps, status codes, request IDs) used for troubleshooting
            and are kept by the operator only.
          </p>
        </section>

        <section>
          <h2>Sharing and deletion</h2>
          <p>
            Your documents are never shared with, sold to, or sent to any third party.
            Deleting a document in the editor removes it and its version history from
            the server. Contact the operator of this instance for anything else.
          </p>
        </section>

        <section>
          <h2>Your responsibility as the operator</h2>
          <p>
            If you run this software for others, you are the data controller: keep the
            deployment updated, secure the passphrase, and back up the documents
            directory.
          </p>
        </section>

        <button type="button" className="action-button policy-card__back" onClick={onBack}>
          Back
        </button>
      </article>
    </main>
  );
}
