import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';

// Suppress browser extension runtime errors immediately
window.addEventListener('error', (event) => {
  if (event.message && (event.message.includes('runtime.lastError') || event.message.includes('Could not establish connection'))) {
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && (event.reason.message.includes('runtime.lastError') || event.reason.message.includes('Could not establish connection'))) {
    event.preventDefault();
    return false;
  }
});

window.addEventListener('load', () => {
  if (typeof window.ethereum !== 'undefined') {
    console.log('MetaMask is installed!');
  }
});

// Google Fonts - Inter
const interFont = "'Inter', sans-serif";

// --- WEB3-INSPIRED DARK THEME ---
const web3Theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#3399FF', // Electric Blue - Năng động và công nghệ
      light: '#66B2FF',
      dark: '#0077E5',
    },
    secondary: {
      main: '#9C27B0', // Deep Purple - Sang trọng và sáng tạo
      light: '#AF52BF',
      dark: '#89229B',
    },
    background: {
      default: '#0A1929', // Nền xanh navy đậm, không phải màu đen tuyền
      paper: 'rgba(17, 34, 51, 0.6)', // Hiệu ứng trong mờ (glassmorphism)
    },
    text: {
      primary: '#E0E0E0', // Màu chữ trắng ngà, dễ chịu cho mắt
      secondary: '#B0B0B0', // Màu chữ phụ
    },
    success: {
      main: '#00E676',
    },
    error: {
      main: '#FF5252',
    },
  },
  typography: {
    fontFamily: interFont,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      '@media (max-width:600px)': {
        fontSize: '2rem',
      },
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      '@media (max-width:600px)': {
        fontSize: '1.75rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      '@media (max-width:600px)': {
        fontSize: '0.95rem',
      },
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.7,
      '@media (max-width:600px)': {
        fontSize: '0.95rem',
        lineHeight: 1.6,
      },
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      '@media (max-width:600px)': {
        fontSize: '0.85rem',
        lineHeight: 1.5,
      },
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.95rem',
      '@media (max-width:600px)': {
        fontSize: '0.9rem',
      },
    },
  },
  shape: {
    borderRadius: 16, // Bo góc mềm mại hơn
  },
  components: {
    // Thêm hiệu ứng nền Aurora cho toàn bộ trang
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0A1929',
          backgroundImage: `
            radial-gradient(at 20% 20%, hsla(210, 80%, 35%, 0.3) 0px, transparent 50%),
            radial-gradient(at 80% 20%, hsla(280, 70%, 40%, 0.3) 0px, transparent 50%),
            radial-gradient(at 20% 80%, hsla(190, 80%, 45%, 0.2) 0px, transparent 50%),
            radial-gradient(at 80% 80%, hsla(340, 70%, 50%, 0.2) 0px, transparent 50%)
          `,
          backgroundAttachment: 'fixed',
        },
        '@media (max-width: 600px)': {
          body: {
            fontSize: '14px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '12px 28px',
          transition: 'all 0.3s ease-in-out',
          minHeight: '44px', // Touch-friendly minimum height
          '@media (max-width:600px)': {
            padding: '14px 24px',
            minHeight: '48px',
            fontSize: '0.95rem',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #3399FF 30%, #0077E5 90%)',
          boxShadow: '0 3px 5px 2px rgba(51, 153, 255, .3)',
          '&:hover': {
            boxShadow: '0 5px 15px 3px rgba(51, 153, 255, .4)',
            transform: 'translateY(-2px)',
          },
          '@media (max-width:600px)': {
            '&:hover': {
              transform: 'none', // Disable hover transform on mobile
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)', // Hiệu ứng mờ nền
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          '@media (max-width:600px)': {
            borderRadius: '12px',
          },
        },
      },
    },
    MuiDialog: {
        styleOverrides: {
            paper: {
                backgroundColor: 'rgba(10, 25, 41, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                '@media (max-width:600px)': {
                  margin: '16px',
                  maxHeight: 'calc(100vh - 32px)',
                  width: 'calc(100vw - 32px)',
                },
            }
        }
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            paddingLeft: '16px',
            paddingRight: '16px',
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            width: '72px',
            height: '72px',
          },
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={web3Theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// Test render
console.log('React app rendered successfully');
