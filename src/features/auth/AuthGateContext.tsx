import { createContext, useContext } from 'react';

export type AuthGateContextValue = {
  /** True when the instance requires a passphrase; false when auth is off. */
  isAuthGated: boolean;
};

export const AuthGateContext = createContext<AuthGateContextValue>({ isAuthGated: false });

/** Lets the app (e.g. the header) know whether signing out is meaningful. */
export function useAuthGate() {
  return useContext(AuthGateContext);
}
