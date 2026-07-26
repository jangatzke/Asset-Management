import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { DarkModeProvider } from './context/DarkModeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <I18nProvider>
        <DarkModeProvider>
          <App />
        </DarkModeProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
