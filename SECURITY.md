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
- Remote document imports pin HTTPS connections to validated public DNS answers
  while retaining hostname TLS verification. Every redirect is checked, with a
  single 15-second DNS/connection/body deadline, a 50 MiB streaming limit and at
  most four active imports per API instance. HTTP content encoding other than
  identity is rejected (DOCX ZIP compression is a separate validation boundary).
- State-changing hosted cookie requests reject explicit foreign origins.
- Responses include CSP, frame, MIME-sniffing, referrer, Permissions-Policy,
  COOP/CORP and HTTPS-only HSTS headers where the proxy reports HTTPS.
- Passphrase login/setup are rate-limited; hosted sessions are opaque and
  revocable rather than JWTs.
- Workspace mutations enforce owner/editor permissions and record audit events.

These controls reduce risk; they do not replace a hardened proxy, secret
rotation, encrypted off-host backups, dependency updates or an authorization
review before a public launch.

URL imports use DNS A/AAAA queries, not hosts-file overrides, and deliberately
reject private, special-purpose and transition addresses. They connect directly
without an environment HTTP proxy. A DNS family without records is acceptable;
resolver failures fail closed. Keep outbound network restrictions at deployment
level too. The admission cap is per instance, not a distributed limit; ZIP header
limits do not yet establish a hard bound on actual DOCX decompression work.

## Reporting

Do not open a public issue for a suspected vulnerability. Report it privately to the repository owner with reproduction steps, impact, and the affected commit.
