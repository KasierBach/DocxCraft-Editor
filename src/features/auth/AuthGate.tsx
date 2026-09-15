import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { readAuthSession, type AuthProvider, type AuthSessionUser } from '../../lib/documentApi';
import { DocumentsPage } from '../library/DocumentsPage';
import { SettingsPage } from '../settings/SettingsPage';
import { ChangelogPage } from '../landing/ChangelogPage';
import { DocsPage } from '../landing/DocsPage';
import { LandingPage } from '../landing/LandingPage';
import { PrivacyPolicy } from '../landing/PrivacyPolicy';
import { TermsOfUse } from '../landing/TermsOfUse';
import { AuthGateContext, type AppPage } from './AuthGateContext';
import { LoginScreen } from './LoginScreen';
import { SetupScreen } from './SetupScreen';

type AuthGateProps = {
  children: ReactNode;
};

/** URL for each gate page; the gate is driven entirely by the current path. */
const GATE_PATHS = {
  app: '/app',
  library: '/documents',
  settings: '/settings',
  landing: '/',
  setup: '/setup',
  signin: '/login',
  privacy: '/privacy',
  terms: '/terms',
  docs: '/docs',
  changelog: '/changelog',
} as const;

type GateView =
  | 'app'
  | 'library'
  | 'settings'
  | 'landing'
  | 'setup'
  | 'signin'
  | 'privacy'
  | 'terms'
  | 'docs'
  | 'changelog';

function viewForPath(pathname: string): GateView {
  switch (pathname) {
    case GATE_PATHS.app:
      return 'app';
    case GATE_PATHS.library:
      return 'library';
    case GATE_PATHS.settings:
      return 'settings';
    case GATE_PATHS.setup:
      return 'setup';
    case GATE_PATHS.signin:
      return 'signin';
    case GATE_PATHS.privacy:
      return 'privacy';
    case GATE_PATHS.terms:
      return 'terms';
    case GATE_PATHS.docs:
      return 'docs';
    case GATE_PATHS.changelog:
      return 'changelog';
    default:
      return 'landing';
  }
}

/**
 * Owns the unauthenticated experience (passphrase gate) and routes the public
 * pages by URL: landing, docs, changelog, policies, sign-in, the documents
 * library, and the editor itself. A failed session check (API offline) falls
 * through to the app, which surfaces its own offline state.
 *
 * From inside the app, reference pages still open as an overlay so the editor,
 * the open document, and unsaved edits are never unmounted.
 */
export function AuthGate({ children }: AuthGateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthGated, setIsAuthGated] = useState(false);
  const [authenticated, setAuthenticated] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [overlayPage, setOverlayPage] = useState<AppPage | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const loadSession = useCallback(() => {
    let cancelled = false;

    void readAuthSession()
      .then((session) => {
        if (cancelled) return;
        setIsAuthGated(session.authRequired);
        setNeedsSetup(session.needsSetup);
        setAuthenticated(!session.authRequired || session.authenticated);
        setUser(session.user ?? null);
        setProviders(session.providers ?? []);
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(true);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadSession(), [loadSession]);

  const openPage = useCallback((page: AppPage) => setOverlayPage(page), []);
  const closePage = useCallback(() => setOverlayPage(null), []);
  const openLibrary = useCallback(() => navigate(GATE_PATHS.library), [navigate]);
  const openSettings = useCallback(() => navigate(GATE_PATHS.settings), [navigate]);

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

  const isAnonymous = user?.isAnonymous ?? false;
  const contextValue = useMemo(
    () => ({ isAuthGated, openPage, closePage, openLibrary, openSettings, providers, isAnonymous }),
    [closePage, isAnonymous, isAuthGated, openLibrary, openPage, openSettings, providers],
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
          onStartEditing={closePage}
          signInProviders={providers}
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

  if (isChecking) {
    return <div className="login-screen" aria-hidden="true" />;
  }

  if (isAuthGated && !authenticated) {
    const reload = () => {
      setIsChecking(true);
      loadSession();
    };

    return needsSetup ? (
      <SetupScreen onClaimed={reload} />
    ) : (
      <LoginScreen onAuthenticated={reload} onBack={() => navigate(GATE_PATHS.landing)} />
    );
  }

  const view = viewForPath(location.pathname);

  if (view === 'app' || view === 'library' || view === 'settings') {
    return (
      <AuthGateContext.Provider value={contextValue}>
        {view === 'app' ? children : view === 'library' ? <DocumentsPage /> : <SettingsPage />}
        {overlay}
      </AuthGateContext.Provider>
    );
  }

  switch (view) {
    case 'signin':
    case 'setup':
      return <Navigate to={GATE_PATHS.app} replace />;
    case 'privacy':
      return <PrivacyPolicy onBack={() => navigate(GATE_PATHS.landing)} />;
    case 'terms':
      return <TermsOfUse onBack={() => navigate(GATE_PATHS.landing)} />;
    case 'docs':
      return <DocsPage onBack={() => navigate(GATE_PATHS.landing)} />;
    case 'changelog':
      return <ChangelogPage onBack={() => navigate(GATE_PATHS.landing)} />;
    case 'landing':
    default:
      return (
        <LandingPage
          needsSetup={needsSetup}
          onPrimaryAction={() => navigate(needsSetup ? GATE_PATHS.setup : GATE_PATHS.signin)}
          onStartEditing={() => navigate(GATE_PATHS.app)}
          signInProviders={providers}
          onShowDocs={() => navigate(GATE_PATHS.docs)}
          onShowChangelog={() => navigate(GATE_PATHS.changelog)}
          onShowPrivacy={() => navigate(GATE_PATHS.privacy)}
          onShowTerms={() => navigate(GATE_PATHS.terms)}
        />
      );
  }
}
