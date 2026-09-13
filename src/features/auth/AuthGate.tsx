import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { readAuthSession } from '../../lib/documentApi';
import { AuthGateContext, type AppPage } from './AuthGateContext';
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
 *
 * Once the app is running, the same pages open as an overlay on top of it so
 * the editor, the open document, and unsaved edits are never unmounted.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [view, setView] = useState<GateView>({ kind: 'checking' });
  const [isAuthGated, setIsAuthGated] = useState(false);
  const [overlayPage, setOverlayPage] = useState<AppPage | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

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

  const openPage = useCallback((page: AppPage) => setOverlayPage(page), []);
  const closePage = useCallback(() => setOverlayPage(null), []);

  // Escape closes the overlay and stops there, so editor drawers and menus
  // behind it keep their own Escape handling untouched. Focus moves into the
  // overlay so keyboard users are not left on the now-closed menu trigger.
  useEffect(() => {
    if (!overlayPage) {
      return undefined;
    }

    overlayRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.stopPropagation();
      setOverlayPage(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [overlayPage]);

  const contextValue = useMemo(
    () => ({ isAuthGated, openPage, closePage }),
    [closePage, isAuthGated, openPage],
  );

  const overlay = overlayPage ? (
    <div
      ref={overlayRef}
      className="app-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Information page"
      tabIndex={-1}
    >
      {overlayPage === 'landing' && (
        <LandingPage
          needsSetup={false}
          onPrimaryAction={closePage}
          onShowDocs={() => setOverlayPage('docs')}
          onShowChangelog={() => setOverlayPage('changelog')}
          onShowPrivacy={() => setOverlayPage('privacy')}
          onShowTerms={() => setOverlayPage('terms')}
        />
      )}
      {overlayPage === 'docs' && <DocsPage onBack={closePage} />}
      {overlayPage === 'changelog' && <ChangelogPage onBack={closePage} />}
      {overlayPage === 'privacy' && <PrivacyPolicy onBack={closePage} />}
      {overlayPage === 'terms' && <TermsOfUse onBack={closePage} />}
    </div>
  ) : null;

  const appView = (
    <AuthGateContext.Provider value={contextValue}>
      {children}
      {overlay}
    </AuthGateContext.Provider>
  );

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
