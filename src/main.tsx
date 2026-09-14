import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';

import '@eigenpal/docx-editor-react/styles.css';
import App from './App';
import { AuthGate } from './features/auth/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';

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
            <AuthGate>
              <App />
            </AuthGate>
          </QueryClientProvider>
        </ErrorBoundary>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
