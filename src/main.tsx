import React from 'react';
import ReactDOM from 'react-dom/client';

import '@eigenpal/docx-editor-react/styles.css';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element #app is missing.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>,
);
