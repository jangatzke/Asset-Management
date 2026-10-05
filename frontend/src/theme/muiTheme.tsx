import { useMemo, type ReactNode } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useDarkMode } from '../context/DarkModeContext';

/** Build the shared MUI theme for the given color mode. */
export const buildMuiTheme = (darkMode: boolean) =>
  createTheme({
    palette: { mode: darkMode ? 'dark' : 'light' },
    components: {
      MuiTableHead: {
        styleOverrides: { root: { backgroundColor: darkMode ? '#374151' : '#f9fafb' } },
      },
      MuiTableCell: {
        styleOverrides: {
          head: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.025em', textTransform: 'uppercase' },
        },
      },
    },
  });

/**
 * Single global MUI theme provider wired to DarkModeContext.
 * Mounted once in main.tsx; pages must not create their own ThemeProvider.
 */
export function AppMuiThemeProvider({ children }: { children: ReactNode }) {
  const { darkMode } = useDarkMode();
  const muiTheme = useMemo(() => buildMuiTheme(darkMode), [darkMode]);
  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>;
}
