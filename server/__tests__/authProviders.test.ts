// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

// The provider module talks to two networks: openid-client for Google discovery
// and plain fetch for GitHub. Both are mocked so the mapping logic (claims →
// OAuthProfile, state validation, email fallback) is exercised offline.
vi.mock('openid-client', () => ({
  discovery: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  randomState: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  authorizationCodeGrant: vi.fn(),
}));

import * as oidc from 'openid-client';

import { createOAuthProviders } from '../auth/providers.ts';

const discovery = oidc.discovery as unknown as Mock;
const randomPKCECodeVerifier = oidc.randomPKCECodeVerifier as unknown as Mock;
const randomState = oidc.randomState as unknown as Mock;
const buildAuthorizationUrl = oidc.buildAuthorizationUrl as unknown as Mock;
const calculatePKCECodeChallenge = oidc.calculatePKCECodeChallenge as unknown as Mock;
const authorizationCodeGrant = oidc.authorizationCodeGrant as unknown as Mock;

const CLIENT = { clientId: 'client-1', clientSecret: 'secret-1' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Routes GitHub's three endpoints without touching the network. */
function stubGitHubFetch(
  overrides: { token?: unknown; tokenStatus?: number; user?: unknown; emails?: unknown } = {},
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : String(input.url);

    if (url.includes('login/oauth/access_token')) {
      return jsonResponse(
        overrides.token ?? { access_token: 'token-1' },
        overrides.tokenStatus ?? 200,
      );
    }
    if (url.endsWith('/user/emails')) {
      return jsonResponse(overrides.emails ?? []);
    }
    if (url.endsWith('/user')) {
      return jsonResponse(overrides.user ?? { id: 7, login: 'octocat' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function googleProvider() {
  const provider = createOAuthProviders({ google: CLIENT }).find(
    (entry) => entry.id === 'google',
  );
  if (!provider) throw new Error('google provider missing');
  return provider;
}

function githubProvider() {
  const provider = createOAuthProviders({ github: CLIENT }).find(
    (entry) => entry.id === 'github',
  );
  if (!provider) throw new Error('github provider missing');
  return provider;
}

function completeGitHub(provider: ReturnType<typeof githubProvider>) {
  return provider.completeAuthorization({
    redirectUri: 'https://app.example/cb',
    query: { code: 'code-1', state: 'state-1' },
    state: 'state-1',
  });
}

describe('createOAuthProviders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds nothing when no client credentials are configured', () => {
    expect(createOAuthProviders({})).toEqual([]);
  });

  it('builds only the providers that have credentials', () => {
    expect(createOAuthProviders({ google: CLIENT }).map((entry) => entry.id)).toEqual(['google']);
    expect(createOAuthProviders({ github: CLIENT }).map((entry) => entry.id)).toEqual(['github']);
  });

  it('lists Google before GitHub when both are configured', () => {
    const providers = createOAuthProviders({ google: CLIENT, github: CLIENT });

    expect(providers.map((entry) => entry.id)).toEqual(['google', 'github']);
    expect(providers.map((entry) => entry.label)).toEqual(['Google', 'GitHub']);
  });
});


describe('GitHub provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds an authorization URL carrying the client id and a random state', async () => {
    const authorization = await githubProvider().createAuthorization('https://app.example/cb');

    const url = new URL(authorization.url);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(authorization.state).toMatch(/^[0-9a-f]{32}$/);
    expect(url.searchParams.get('state')).toBe(authorization.state);
    expect(authorization.codeVerifier).toBeUndefined();
  });

  it('rejects a callback without an authorization code', async () => {
    await expect(
      githubProvider().completeAuthorization({
        redirectUri: 'https://app.example/cb',
        query: { state: 'abc' },
        state: 'abc',
      }),
    ).rejects.toThrow('GitHub did not return an authorization code.');
  });

  it('rejects a callback whose state does not match', async () => {
    await expect(
      githubProvider().completeAuthorization({
        redirectUri: 'https://app.example/cb',
        query: { code: 'code-1', state: 'tampered' },
        state: 'expected',
      }),
    ).rejects.toThrow('GitHub OAuth state did not match.');
  });

  it('rejects a token exchange that returns no access token', async () => {
    stubGitHubFetch({ token: {} });

    await expect(completeGitHub(githubProvider())).rejects.toThrow(
      'GitHub token exchange failed.',
    );
  });

  it('maps the GitHub profile when the user document carries an email', async () => {
    const fetchSpy = stubGitHubFetch({
      user: {
        id: 4711,
        login: 'octocat',
        name: 'Mona Lisa',
        email: 'mona@example.com',
        avatar_url: 'https://avatars.example/mona.png',
      },
    });

    const profile = await completeGitHub(githubProvider());

    expect(profile).toEqual({
      provider: 'github',
      providerAccountId: '4711',
      email: 'mona@example.com',
      emailVerified: true,
      name: 'Mona Lisa',
      avatarUrl: 'https://avatars.example/mona.png',
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      'https://api.github.com/user/emails',
      expect.anything(),
    );
  });


  it('falls back to the primary verified address from /user/emails', async () => {
    stubGitHubFetch({
      user: { id: 4711, login: 'octocat', email: null, avatar_url: null },
      emails: [
        { email: 'secondary@example.com', primary: false, verified: true },
        { email: 'primary@example.com', primary: true, verified: true },
      ],
    });

    const profile = await completeGitHub(githubProvider());

    expect(profile).toMatchObject({
      providerAccountId: '4711',
      email: 'primary@example.com',
      emailVerified: true,
      // No display name from GitHub, so the login is the fallback.
      name: 'octocat',
    });
  });

  it('accepts any verified address when none is primary', async () => {
    stubGitHubFetch({
      user: { id: 99, login: 'ghost', name: '', email: null, avatar_url: null },
      emails: [
        { email: 'unverified@example.com', primary: true, verified: false },
        { email: 'verified@example.com', primary: false, verified: true },
      ],
    });

    const profile = await completeGitHub(githubProvider());

    expect(profile).toMatchObject({
      providerAccountId: '99',
      email: 'verified@example.com',
      emailVerified: true,
    });
  });

  it('reports an unverified, unknown identity when GitHub exposes no verified email', async () => {
    stubGitHubFetch({
      user: { id: 100, login: 'anon', email: null, avatar_url: null },
      emails: [{ email: 'pending@example.com', primary: true, verified: false }],
    });

    const profile = await completeGitHub(githubProvider());

    expect(profile).toEqual({
      provider: 'github',
      providerAccountId: '100',
      email: null,
      emailVerified: false,
      name: 'anon',
      avatarUrl: null,
    });
  });
});


describe('Google provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubGoogle(claims: unknown) {
    discovery.mockResolvedValue({ serverMetadata: () => ({ issuer: 'https://accounts.google.com' }) });
    randomPKCECodeVerifier.mockReturnValue('verifier-1');
    randomState.mockReturnValue('state-1');
    calculatePKCECodeChallenge.mockResolvedValue('challenge-1');
    buildAuthorizationUrl.mockReturnValue(
      new URL('https://accounts.google.com/o/oauth2/v2/auth?client_id=client-1'),
    );
    authorizationCodeGrant.mockResolvedValue({ claims: () => claims });
  }

  function completeGoogle(provider: ReturnType<typeof googleProvider>) {
    return provider.completeAuthorization({
      redirectUri: 'https://app.example/cb',
      query: { code: 'code-1', state: 'state-1', error: undefined },
      state: 'state-1',
      codeVerifier: 'verifier-1',
    });
  }

  it('builds a PKCE authorization request and memoizes discovery', async () => {
    stubGoogle({ sub: '42' });

    const provider = googleProvider();
    const first = await provider.createAuthorization('https://app.example/cb');
    const second = await provider.createAuthorization('https://app.example/cb');

    expect(first).toEqual({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=client-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
    });
    expect(second.state).toBe('state-1');
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        redirect_uri: 'https://app.example/cb',
        scope: 'openid email profile',
        code_challenge: 'challenge-1',
        code_challenge_method: 'S256',
        state: 'state-1',
      }),
    );
    // Discovery is network-bound, so it must happen once per provider instance.
    expect(discovery).toHaveBeenCalledTimes(1);
  });

  it('maps ID-token claims onto the profile', async () => {
    stubGoogle({
      sub: 1234,
      email: 'mona@example.com',
      email_verified: true,
      name: 'Mona Lisa',
      picture: 'https://avatars.example/mona.png',
    });

    const profile = await completeGoogle(googleProvider());

    expect(profile).toEqual({
      provider: 'google',
      providerAccountId: '1234',
      email: 'mona@example.com',
      emailVerified: true,
      name: 'Mona Lisa',
      avatarUrl: 'https://avatars.example/mona.png',
    });

    // Query entries whose value is undefined are dropped from the callback URL.
    const [, currentUrl] = authorizationCodeGrant.mock.calls[0] ?? [];
    expect(String(currentUrl)).toContain('code=code-1');
    expect(String(currentUrl)).not.toContain('error');
    expect(authorizationCodeGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        pkceCodeVerifier: 'verifier-1',
        expectedState: 'state-1',
        idTokenExpected: true,
      }),
    );
  });

  it('normalizes claims that omit optional profile fields', async () => {
    stubGoogle({ sub: 'seven', email_verified: false });

    const profile = await completeGoogle(googleProvider());

    expect(profile).toEqual({
      provider: 'google',
      providerAccountId: 'seven',
      email: null,
      emailVerified: false,
      name: null,
      avatarUrl: null,
    });
  });

  it('rejects a response with no ID token', async () => {
    stubGoogle(undefined);

    await expect(completeGoogle(googleProvider())).rejects.toThrow(
      'Google did not return an ID token subject.',
    );
  });

  it('rejects an ID token without a subject', async () => {
    stubGoogle({ email: 'mona@example.com' });

    await expect(completeGoogle(googleProvider())).rejects.toThrow(
      'Google did not return an ID token subject.',
    );
  });
});
