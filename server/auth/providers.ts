import { randomBytes } from 'node:crypto';

import * as oidc from 'openid-client';

import type { OAuthProfile } from '../accountService.ts';
import type { OAuthClientConfig } from '../config.ts';

export type OAuthProviderId = 'google' | 'github';

export type OAuthAuthorization = {
  url: string;
  state: string;
  /** Present for PKCE providers (Google). */
  codeVerifier?: string;
};

export interface OAuthProvider {
  id: OAuthProviderId;
  label: string;
  createAuthorization(redirectUri: string): Promise<OAuthAuthorization>;
  completeAuthorization(input: {
    redirectUri: string;
    query: Record<string, string | undefined>;
    state: string;
    codeVerifier?: string;
  }): Promise<OAuthProfile>;
}

/** Google via OpenID Connect (PKCE + ID-token validation through openid-client). */
function createGoogleProvider({ clientId, clientSecret }: OAuthClientConfig): OAuthProvider {
  // Discovery needs the network, so it is deferred until the first sign-in.
  let configPromise: Promise<oidc.Configuration> | undefined;
  const getConfig = () =>
    (configPromise ??= oidc.discovery(new URL('https://accounts.google.com'), clientId, clientSecret));

  return {
    id: 'google',
    label: 'Google',
    async createAuthorization(redirectUri) {
      const config = await getConfig();
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const state = oidc.randomState();
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state,
      });
      return { url: url.href, state, codeVerifier };
    },
    async completeAuthorization({ redirectUri, query, state, codeVerifier }) {
      const config = await getConfig();
      const currentUrl = new URL(redirectUri);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) currentUrl.searchParams.set(key, value);
      }

      const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims || claims.sub === undefined) {
        throw new Error('Google did not return an ID token subject.');
      }

      return {
        provider: 'google',
        providerAccountId: String(claims.sub),
        email: typeof claims.email === 'string' ? claims.email : null,
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === 'string' ? claims.name : null,
        avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
      };
    },
  };
}

/** GitHub via plain OAuth2 (no OIDC); email is resolved through /user/emails. */
function createGitHubProvider({ clientId, clientSecret }: OAuthClientConfig): OAuthProvider {
  const exchangeCode = async (code: string) => {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) {
      throw new Error('GitHub token exchange failed.');
    }
    return body.access_token;
  };

  return {
    id: 'github',
    label: 'GitHub',
    async createAuthorization() {
      const state = randomBytes(16).toString('hex');
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return { url: url.href, state };
    },
    async completeAuthorization({ query, state }) {
      if (!query.code) {
        throw new Error('GitHub did not return an authorization code.');
      }
      if (query.state !== state) {
        throw new Error('GitHub OAuth state did not match.');
      }

      const accessToken = await exchangeCode(query.code);
      const headers = {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'docxcraft',
      };

      const user = (await (await fetch('https://api.github.com/user', { headers })).json()) as {
        id: number;
        login?: string;
        name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      };

      let email = user.email ?? null;
      let emailVerified = Boolean(email);
      if (!email) {
        const emails = (await (
          await fetch('https://api.github.com/user/emails', { headers })
        ).json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
        const preferred = emails.find((entry) => entry.primary && entry.verified)
          ?? emails.find((entry) => entry.verified);
        email = preferred?.email ?? null;
        emailVerified = Boolean(preferred);
      }

      return {
        provider: 'github',
        providerAccountId: String(user.id),
        email,
        emailVerified,
        name: user.name ?? user.login ?? null,
        avatarUrl: user.avatar_url ?? null,
      };
    },
  };
}

/** Builds only the providers whose credentials are configured. */
export function createOAuthProviders(clients: {
  google?: OAuthClientConfig;
  github?: OAuthClientConfig;
}): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (clients.google) {
    providers.push(createGoogleProvider(clients.google));
  }
  if (clients.github) {
    providers.push(createGitHubProvider(clients.github));
  }
  return providers;
}
