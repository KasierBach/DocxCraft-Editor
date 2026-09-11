import React from 'react';
import ReactDOM from 'react-dom/client';

import '@eigenpal/docx-editor-react/styles.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';


ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
