# Security policy

## Deployment boundary

The self-hosted distribution is local-first. It can run with `AUTH_MODE=off` for
trusted local development, or with the passphrase claim/login flow for a shared
single-instance deployment. Hosted mode uses Postgres-backed guest/OAuth users,
revocable HTTP-only sessions and workspace owner/editor/viewer roles.

Do not expose an `AUTH_MODE=off` instance to a network. For any public deployment
use HTTPS, a trusted reverse proxy, an exact CORS origin, rate limiting, backups
for both metadata and blobs, and the deployment settings documented in the
[README](README.md).

## Current protections

- Request bodies and DOCX uploads are size-, MIME-, signature- and ZIP-validated.
- Remote document imports enforce HTTPS, public-address checks, redirect checks,
  streaming limits and an upstream timeout.
- State-changing hosted cookie requests reject explicit foreign origins.
- Responses include CSP, frame, MIME-sniffing, referrer, Permissions-Policy,
  COOP/CORP and HTTPS-only HSTS headers where the proxy reports HTTPS.
- Passphrase login/setup are rate-limited; hosted sessions are opaque and
  revocable rather than JWTs.
- Workspace mutations enforce owner/editor permissions and record audit events.

These controls reduce risk; they do not replace a hardened proxy, secret
rotation, encrypted off-host backups, dependency updates or an authorization
review before a public launch.

## Reporting

Do not open a public issue for a suspected vulnerability. Report it privately to the repository owner with reproduction steps, impact, and the affected commit.
