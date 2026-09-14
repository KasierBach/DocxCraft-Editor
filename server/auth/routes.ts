import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AccountService, OAuthProfile } from '../accountService.ts';
import type { AuditService } from '../audit.ts';
import { clearCookie, readCookies, serializeCookie } from '../cookies.ts';
import { SESSION_COOKIE_NAME, type SessionService, type SessionUser } from '../session.ts';
import type { OAuthProvider, OAuthProviderId } from './providers.ts';

const STATE_COOKIE = 'docx_oauth_state';
const VERIFIER_COOKIE = 'docx_oauth_verifier';
const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

export type AccountsOptions = {
  accounts: AccountService;
  sessions: SessionService;
  providers: OAuthProvider[];
  /** Public origin the browser uses; redirect URIs are derived from it. */
  baseUrl: string;
  audit?: AuditService;
};

export function isSecureBaseUrl(baseUrl: string) {
  return baseUrl.startsWith('https:');
}

function maxAgeSeconds(expiresAt: Date) {
  return Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}

function toPublicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAnonymous: user.isAnonymous,
  };
}

function providerList(providers: OAuthProvider[]) {
  return providers.map((provider) => ({ id: provider.id, label: provider.label }));
}

export type SessionPayload = {
  authRequired: false;
  needsSetup: false;
  authenticated: boolean;
  user: ReturnType<typeof toPublicUser>;
  providers: Array<{ id: OAuthProviderId; label: string }>;
};

/**
 * Returns the current session, minting an anonymous guest + session cookie on
 * first visit so the editor is usable with no sign-up.
 */
export async function handleHostedSession(
  request: FastifyRequest,
  reply: FastifyReply,
  options: AccountsOptions,
): Promise<SessionPayload> {
  const cookies = readCookies(request.headers.cookie);
  const existing = await options.sessions.resolve(cookies[SESSION_COOKIE_NAME]);

  if (existing) {
    return {
      authRequired: false,
      needsSetup: false,
      authenticated: !existing.user.isAnonymous,
      user: toPublicUser(existing.user),
      providers: providerList(options.providers),
    };
  }

  const guestId = await options.accounts.createGuest();
  const { token, expiresAt } = await options.sessions.createForUser(guestId, {
    userAgent: request.headers['user-agent'] ?? null,
    ip: request.ip,
  });
  reply.header(
    'set-cookie',
    serializeCookie(SESSION_COOKIE_NAME, token, {
      secure: isSecureBaseUrl(options.baseUrl),
      maxAgeSeconds: maxAgeSeconds(expiresAt),
    }),
  );

  return {
    authRequired: false,
    needsSetup: false,
    authenticated: false,
    user: { id: guestId, email: null, name: null, avatarUrl: null, isAnonymous: true },
    providers: providerList(options.providers),
  };
}

/** Sign-out, OAuth start, and OAuth callback (with guest → account merge). */
export function registerAccountRoutes(app: FastifyInstance, options: AccountsOptions) {
  const findProvider = (id: string) => options.providers.find((provider) => provider.id === id);

  app.post('/api/auth/logout', async (request, reply) => {
    const cookies = readCookies(request.headers.cookie);
    await options.sessions.revoke(cookies[SESSION_COOKIE_NAME]);
    reply.header('set-cookie', clearCookie(SESSION_COOKIE_NAME));
    return reply.code(204).send();
  });

  app.get('/api/auth/:provider/start', async (request, reply) => {
    const provider = findProvider((request.params as { provider: string }).provider);
    if (!provider) {
      return reply.code(404).send({ message: 'Unknown sign-in provider.' });
    }

    const redirectUri = `${options.baseUrl}/api/auth/${provider.id}/callback`;
    const authorization = await provider.createAuthorization(redirectUri);
    const cookieOptions = {
      secure: isSecureBaseUrl(options.baseUrl),
      maxAgeSeconds: OAUTH_COOKIE_MAX_AGE_SECONDS,
    };
    reply.header('set-cookie', serializeCookie(STATE_COOKIE, authorization.state, cookieOptions));
    if (authorization.codeVerifier) {
      reply.header(
        'set-cookie',
        serializeCookie(VERIFIER_COOKIE, authorization.codeVerifier, cookieOptions),
      );
    }

    return reply.redirect(authorization.url);
  });

  app.get('/api/auth/:provider/callback', async (request, reply) => {
    const provider = findProvider((request.params as { provider: string }).provider);
    if (!provider) {
      return reply.code(404).send({ message: 'Unknown sign-in provider.' });
    }

    const cookies = readCookies(request.headers.cookie);
    if (!cookies[STATE_COOKIE]) {
      return reply.code(400).send({ message: 'The sign-in attempt expired. Try again.' });
    }

    let profile: OAuthProfile;
    try {
      profile = await provider.completeAuthorization({
        redirectUri: `${options.baseUrl}/api/auth/${provider.id}/callback`,
        query: request.query as Record<string, string | undefined>,
        state: cookies[STATE_COOKIE],
        codeVerifier: cookies[VERIFIER_COOKIE],
      });
    } catch {
      return reply.code(400).send({ message: 'Sign-in could not be completed. Try again.' });
    }

    const { userId } = await options.accounts.findOrCreateUserFromProfile(profile);
    await options.audit?.record({ action: 'account.sign_in', actorUserId: userId, ip: request.ip });

    // Fold the guest's work into the account they just signed in to.
    const current = await options.sessions.resolve(cookies[SESSION_COOKIE_NAME]);
    if (current?.user.isAnonymous) {
      await options.accounts.mergeGuestIntoUser(current.user.id, userId);
    }

    const { token, expiresAt } = await options.sessions.createForUser(userId, {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    });
    reply.header(
      'set-cookie',
      serializeCookie(SESSION_COOKIE_NAME, token, {
        secure: isSecureBaseUrl(options.baseUrl),
        maxAgeSeconds: maxAgeSeconds(expiresAt),
      }),
    );
    reply.header('set-cookie', clearCookie(STATE_COOKIE));
    reply.header('set-cookie', clearCookie(VERIFIER_COOKIE));

    return reply.redirect(options.baseUrl);
  });
}

/** Resolves the caller's session or answers 401. */
async function requireSession(
  request: FastifyRequest,
  reply: FastifyReply,
  options: AccountsOptions,
) {
  const cookies = readCookies(request.headers.cookie);
  const session = await options.sessions.resolve(cookies[SESSION_COOKIE_NAME]);
  if (!session) {
    void reply.code(401).send({ message: 'A session is required.' });
    return null;
  }
  return session;
}

/** Account export and deletion. Kept separate from the sign-in routes. */
export function registerAccountDataRoutes(app: FastifyInstance, options: AccountsOptions) {
  app.get('/api/account/export', async (request, reply) => {
    const session = await requireSession(request, reply, options);
    if (!session) return reply;

    await options.audit?.record({
      action: 'account.export',
      actorUserId: session.user.id,
      ip: request.ip,
    });

    const exported = await options.accounts.exportAccount(session.user.id);
    reply.header('content-type', 'application/json');
    reply.header('content-disposition', 'attachment; filename="docxcraft-export.json"');
    return reply.send(JSON.stringify(exported, null, 2));
  });

  app.delete('/api/account', async (request, reply) => {
    const session = await requireSession(request, reply, options);
    if (!session) return reply;

    await options.audit?.record({
      action: 'account.delete',
      actorUserId: session.user.id,
      ip: request.ip,
    });

    await options.accounts.deleteAccount(session.user.id);
    reply.header('set-cookie', clearCookie(SESSION_COOKIE_NAME));
    return reply.code(204).send();
  });
}
