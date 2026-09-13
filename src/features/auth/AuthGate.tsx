import { useEffect, useState, type ReactNode } from 'react';

import { readAuthSession } from '../../lib/documentApi';
import { AuthGateContext } from './AuthGateContext';
import { ChangelogPage } from '../landing/ChangelogPage';
import { DocsPage } from '../landing/DocsPage';
import { LandingPage } from '../landing/LandingPage';
import { LoginScreen } from './LoginScreen';
import { PrivacyPolicy } from '../landing/PrivacyPolicy';
import { SetupScreen } from './SetupScreen';
import { TermsOfUse } from '../landing/TermsOfUse';

type AuthGateProps = {
  children: ReactNode;
};

type GateView =
  | { kind: 'checking' }
  | { kind: 'app' }
  | { kind: 'landing'; needsSetup: boolean }
  | { kind: 'setup' }
  | { kind: 'signin' }
  | { kind: 'privacy' }
  | { kind: 'terms' }
  | { kind: 'docs' }
  | { kind: 'changelog' };

/**
 * Owns the unauthenticated experience: landing page, first-run instance
 * claiming, and sign-in. Renders the app only once a session exists (or auth
 * is disabled). A failed session check (API offline) falls through to the
 * app, which surfaces its own offline state.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [view, setView] = useState<GateView>({ kind: 'checking' });
  const [isAuthGated, setIsAuthGated] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void readAuthSession()
      .then((session) => {
        if (isCancelled) return;
        setIsAuthGated(session.authRequired);
        if (!session.authRequired || session.authenticated) {
          setView({ kind: 'app' });
        } else if (session.needsSetup) {
          setView({ kind: 'landing', needsSetup: true });
        } else {
          setView({ kind: 'landing', needsSetup: false });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setView({ kind: 'app' });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const appView = <AuthGateContext.Provider value={{ isAuthGated }}>{children}</AuthGateContext.Provider>;

  switch (view.kind) {
    case 'checking':
      return <div className="login-screen" aria-hidden="true" />;
    case 'app':
      return appView;
    case 'setup':
      return <SetupScreen onClaimed={() => setView({ kind: 'app' })} />;
    case 'signin':
      return (
        <LoginScreen
          onAuthenticated={() => setView({ kind: 'app' })}
          onBack={() => setView({ kind: 'landing', needsSetup: false })}
        />
      );
    case 'privacy':
      return <PrivacyPolicy onBack={() => setView({ kind: 'landing', needsSetup: false })} />;
    case 'terms':
      return <TermsOfUse onBack={() => setView({ kind: 'landing', needsSetup: false })} />;
    case 'docs':
      return <DocsPage onBack={() => setView({ kind: 'landing', needsSetup: false })} />;
    case 'changelog':
      return <ChangelogPage onBack={() => setView({ kind: 'landing', needsSetup: false })} />;
    case 'landing':
      return (
        <LandingPage
          needsSetup={view.needsSetup}
          onPrimaryAction={() =>
            setView(view.needsSetup ? { kind: 'setup' } : { kind: 'signin' })
          }
          onShowDocs={() => setView({ kind: 'docs' })}
          onShowChangelog={() => setView({ kind: 'changelog' })}
          onShowPrivacy={() => setView({ kind: 'privacy' })}
          onShowTerms={() => setView({ kind: 'terms' })}
        />
      );
  }
}
