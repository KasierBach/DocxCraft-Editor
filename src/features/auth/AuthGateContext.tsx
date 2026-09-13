import { createContext, useContext } from 'react';

/** Marketing and reference pages that can be opened over the running app. */
export type AppPage = 'landing' | 'docs' | 'changelog' | 'privacy' | 'terms';

export type AuthGateContextValue = {
  /** True when the instance requires a passphrase; false when auth is off. */
  isAuthGated: boolean;
  /** Opens a landing/docs/changelog page over the app without unmounting it. */
  openPage: (page: AppPage) => void;
  /** Closes the page overlay and returns to the editor. */
  closePage: () => void;
};

export const AuthGateContext = createContext<AuthGateContextValue>({
  isAuthGated: false,
  openPage: () => undefined,
  closePage: () => undefined,
});

/** Lets the app (e.g. the header) know whether signing out is meaningful. */
export function useAuthGate() {
  return useContext(AuthGateContext);
}
