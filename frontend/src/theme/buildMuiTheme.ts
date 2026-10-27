import { createTheme } from '@mui/material/styles';

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
