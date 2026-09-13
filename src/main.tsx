import React from 'react';
import ReactDOM from 'react-dom/client';

import '@eigenpal/docx-editor-react/styles.css';
import App from './App';
import { AuthGate } from './features/auth/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element #app is missing.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <AuthGate>
          <App />
        </AuthGate>
      </ErrorBoundary>
    </I18nProvider>
  </React.StrictMode>,
);
