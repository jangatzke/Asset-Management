import { useMemo, type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useDarkMode } from '../context/DarkModeContext';
import { buildMuiTheme } from './buildMuiTheme';

/**
 * Single global MUI theme provider wired to DarkModeContext.
 * Mounted once in main.tsx; pages must not create their own ThemeProvider.
 */
export function AppMuiThemeProvider({ children }: { children: ReactNode }) {
  const { darkMode } = useDarkMode();
  const muiTheme = useMemo(() => buildMuiTheme(darkMode), [darkMode]);
  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>;
}
