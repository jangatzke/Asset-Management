import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { DensityProvider } from './context/DensityContext';
import { ToastProvider } from './components/ToastProvider';
import { AppMuiThemeProvider } from './theme/muiTheme';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <DarkModeProvider>
          {/* Global density (LT-3): mounted outside the routes so every page and
              the Layout top bar can read/toggle the persisted preference. */}
          <DensityProvider>
            <AppMuiThemeProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </AppMuiThemeProvider>
          </DensityProvider>
        </DarkModeProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
