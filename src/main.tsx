import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';

import '@eigenpal/docx-editor-react/styles.css';
import './app.css';
import { AuthGate } from './features/auth/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider, useTranslation } from './i18n';

const App = lazy(() => import('./App'));

function EditorLoading() {
  const { t } = useTranslation();
  return <div className="login-screen" role="status" aria-busy="true">{t('profile.loading')}</div>;
}

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element #app is missing.');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<EditorLoading />}>
              <AuthGate>
                <App />
              </AuthGate>
            </Suspense>
          </QueryClientProvider>
        </ErrorBoundary>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
