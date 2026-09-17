import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import {
  AuthGateContext,
  type AuthGateContextValue,
} from '../features/auth/AuthGateContext';
import type { AuthProvider } from '../lib/documentApi';

type ProfileHarnessOptions = {
  isAnonymous?: boolean;
  providers?: AuthProvider[];
  route?: string;
};

/** Renders a profile component with the query client, router, and auth context it needs. */
export function renderProfile(ui: ReactElement, options: ProfileHarnessOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const context: AuthGateContextValue = {
    isAuthGated: false,
    openPage: () => undefined,
    closePage: () => undefined,
    openLibrary: () => undefined,
    openSettings: () => undefined,
    openSignIn: () => undefined,
    providers: options.providers ?? [],
    isAnonymous: options.isAnonymous ?? false,
  };

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>
        <AuthGateContext.Provider value={context}>{ui}</AuthGateContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
