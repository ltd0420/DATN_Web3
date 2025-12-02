import { createTheme } from '@mui/material/styles';

// Modern Admin Theme with White Background
const adminTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // Modern blue
      light: '#60a5fa',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed', // Modern purple
      light: '#a78bfa',
      dark: '#5b21b6',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa', // Light gray background
      paper: '#ffffff', // Pure white for cards
    },
    text: {
      primary: '#1f2937', // Dark gray
      secondary: '#6b7280', // Medium gray
    },
    grey: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    success: {
      main: '#059669',
      light: '#34d399',
      dark: '#047857',
    },
    warning: {
      main: '#d97706',
      light: '#fbbf24',
      dark: '#b45309',
    },
    error: {
      main: '#dc2626',
      light: '#f87171',
      dark: '#b91c1c',
    },
    info: {
      main: '#0891b2',
      light: '#22d3ee',
      dark: '#0e7490',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: '-0.015em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.45,
      letterSpacing: '-0.005em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      letterSpacing: '0.01em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 12, // Modern rounded corners
  },
  shadows: [
    'none',
    '0px 1px 2px 0px rgba(0,0,0,0.05)',
    '0px 1px 3px 0px rgba(0,0,0,0.1),0px 1px 2px 0px rgba(0,0,0,0.06)',
    '0px 4px 6px -1px rgba(0,0,0,0.1),0px 2px 4px -1px rgba(0,0,0,0.06)',
    '0px 10px 15px -3px rgba(0,0,0,0.1),0px 4px 6px -2px rgba(0,0,0,0.05)',
    '0px 20px 25px -5px rgba(0,0,0,0.1),0px 10px 10px -5px rgba(0,0,0,0.04)',
    '0px 25px 50px -12px rgba(0,0,0,0.25)',
    ...Array(19).fill('0px 25px 50px -12px rgba(0,0,0,0.25)'), // Fill remaining shadows
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f5f9',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#cbd5e1',
            borderRadius: '4px',
            '&:hover': {
              background: '#94a3b8',
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          '&:hover': {
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
          border: '1px solid #e5e7eb',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 10px 25px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          '&:hover': {
            backgroundColor: '#f3f4f6',
          },
          '&.Mui-selected': {
            backgroundColor: '#eff6ff',
            '&:hover': {
              backgroundColor: '#dbeafe',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#d1d5db',
            },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#f9fafb',
            fontWeight: 600,
            color: '#374151',
            borderBottom: '1px solid #e5e7eb',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#f9fafb',
          },
        },
      },
    },
  },
});

export default adminTheme;
