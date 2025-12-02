import React, { useState, useEffect } from 'react';
import {
  Container, Box, Typography, Button, Paper, Alert,
  CircularProgress, Fade, Grow, Avatar, Chip, Link,
  useTheme, useMediaQuery, Tabs, Tab, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  VerifiedUser as VerifiedUserIcon,
  ChevronRight as ChevronRightIcon,
  Language as LanguageIcon,
  HelpOutline as HelpIcon,
  QrCodeScanner as QrCodeScannerIcon
} from '@mui/icons-material';
import MetaMaskGuideModal from './MetaMaskGuideModal';
import QrScanner from './QrScanner';
import authService from '../services/authService';
import apiService from '../services/apiService';

// Role ID constants (keep in sync with App.js)
const EMPLOYEE_ROLE = '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c';
const MANAGER_ROLE = '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b';
const SUPER_ADMIN_ROLE = '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a';

// --- Animated Gradient Text Component ---
function AnimatedGradientText({ children, sx }) {
  return (
    <Typography
      sx={{
        background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.light}, ${theme.palette.success.main}, ${theme.palette.secondary.light})`,
        backgroundSize: '200% 200%',
        animation: 'gradientAnimation 5s ease infinite',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        '@keyframes gradientAnimation': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

// --- Main LoginPage Component ---
function LoginPage() {
  console.log('LoginPage component rendered');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isVerySmall = useMediaQuery(theme.breakpoints.down(400));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scanningQr, setScanningQr] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      const currentUser = authService.getCurrentUser();
      setIsAuthenticated(authenticated);
      setUser(currentUser);
    };
    checkAuth();

    authService.onAccountChange((account) => {
      if (!account) {
        setIsAuthenticated(false);
        setUser(null);
        setError('Ví đã bị ngắt kết nối. Vui lòng kết nối lại.');
      }
    });

    authService.onChainChange(() => window.location.reload());
  }, []);

  const handleConnectWallet = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!authService.isMetaMaskInstalled()) {
        setError('Vui lòng cài đặt ví MetaMask để tiếp tục.');
        setGuideModalOpen(true);
        return;
      }

      await authService.initializeProvider();
      const walletAddress = await authService.getWalletAddress();
      setConnectedWallet(walletAddress); // Store connected wallet address

      const result = await authService.authenticate(walletAddress);
      setSuccess('Đăng nhập thành công! Đang chuyển hướng đến dashboard...');
      setIsAuthenticated(true);
      setUser(result.user);

      // Store JWT token in localStorage
      localStorage.setItem('authToken', result.token);

      // Redirect to dashboard after success message
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2500);
    } catch (err) {
      const message = err.message || 'Có lỗi xảy ra, vui lòng thử lại.';
      if (message.includes('user rejected')) setError('Bạn đã từ chối yêu cầu kết nối.');
      else if (message.includes('wallet not registered')) setError('Ví này chưa được đăng ký. Vui lòng liên hệ Phòng Nhân sự.');
      else if (message.includes('employee inactive')) setError('Tài khoản của bạn đã bị vô hiệu hóa.');
      else setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = async (qrData) => {
    setScanningQr(true);
    setError('');
    setSuccess('');
    try {
      // Parse QR data - expected format: JSON with qr_code_id, qr_hash, employee_did, etc.
      const qrInfo = JSON.parse(qrData);

      // Validate QR data structure
      if (!qrInfo.qr_code_id || !qrInfo.qr_hash || !qrInfo.employee_did) {
        throw new Error('QR code không hợp lệ. Thiếu thông tin cần thiết.');
      }

      // Validate QR code against backend database
      console.log('Validating QR with backend:', {
        qr_code_id: qrInfo.qr_code_id,
        qr_hash: qrInfo.qr_hash
      });
      const validationResponse = await apiService.validateQrForLogin({
        qr_code_id: qrInfo.qr_code_id,
        qr_hash: qrInfo.qr_hash
      });
      console.log('QR validation response:', validationResponse);

      if (!validationResponse.success) {
        throw new Error('QR code không hợp lệ hoặc đã bị vô hiệu hóa.');
      }

      // Check if MetaMask is installed
      if (!authService.isMetaMaskInstalled()) {
        setError('Vui lòng cài đặt ví MetaMask để tiếp tục.');
        setGuideModalOpen(true);
        return;
      }

      // Simple MetaMask connection without network switching
      try {
        console.log('Requesting MetaMask accounts...');
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        if (accounts.length === 0) {
          throw new Error('Không có tài khoản MetaMask nào được kết nối.');
        }

        console.log('Initializing MetaMask provider...');
        await authService.initializeProvider();
        const walletAddress = await authService.getWalletAddress();
        console.log('Wallet address obtained:', walletAddress);
        setConnectedWallet(walletAddress);

        console.log('Authenticating with wallet address...');
        const result = await authService.authenticate(walletAddress);
        console.log('Authentication result:', result);
        setSuccess('Đăng nhập bằng QR thành công! Đang chuyển hướng...');
        setIsAuthenticated(true);
        setUser(result.user);

        localStorage.setItem('authToken', result.token);

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2500);
      } catch (metaMaskError) {
        console.error('MetaMask error:', metaMaskError);
        if (metaMaskError.code === 4001) {
          throw new Error('Bạn đã từ chối kết nối MetaMask.');
        } else {
          throw new Error('Lỗi kết nối MetaMask. Vui lòng thử lại.');
        }
      }

    } catch (err) {
      const message = err.message || 'Có lỗi xảy ra khi quét QR.';
      setError(message);
    } finally {
      setScanningQr(false);
      setQrScannerOpen(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError('');
    setSuccess('');
  };

  // Get display name for user's position based on role
  const getPositionDisplayName = () => {
    if (!user) return 'Intern';

    if (user.role_id === SUPER_ADMIN_ROLE) {
      return 'Quản trị hệ thống';
    }

    if (user.role_id === MANAGER_ROLE) {
      return 'Quản lý';
    }

    // For normal employees, fall back to profile position or default
    return user.chuc_vu || 'Intern';
  };

  // Get display text for user's department
  const getDepartmentDisplayName = () => {
    if (!user || !user.phong_ban_id) {
      return 'Chưa vào Phòng ban';
    }

    const dept = user.phong_ban_id;

    // If backend only returns department id as string
    if (typeof dept === 'string') {
      return `ID: ${dept}`;
    }

    // If backend returns populated object with name + id
    const name = dept.ten_phong_ban || dept.name || 'Không rõ';
    const id = dept._id || dept.id || dept.phong_ban_id || '';

    return id ? `${name} (${id})` : name;
  };

  // --- Responsive styles ---
  const getResponsiveStyles = () => {
    if (isVerySmall) {
      return {
        containerPadding: 1,
        paperPadding: 1.5,
        avatarSize: 56,
        iconSize: 40,
        titleVariant: "h5",
        subtitleVariant: "body1",
        subtitleFontSize: '0.9rem',
        buttonPadding: 1.2,
        buttonFontSize: '0.9rem',
        chipSize: "small",
        spacing: 1
      };
    } else if (isMobile) {
      return {
        containerPadding: 2,
        paperPadding: 2,
        avatarSize: 64,
        iconSize: 48,
        titleVariant: "h4",
        subtitleVariant: "h6",
        subtitleFontSize: '1rem',
        buttonPadding: 1.5,
        buttonFontSize: '0.95rem',
        chipSize: "small",
        spacing: 2
      };
    } else if (isTablet) {
      return {
        containerPadding: 3,
        paperPadding: 3,
        avatarSize: 80,
        iconSize: 60,
        titleVariant: "h3",
        subtitleVariant: "h6",
        subtitleFontSize: '1.25rem',
        buttonPadding: 2,
        buttonFontSize: '1.1rem',
        chipSize: "medium",
        spacing: 3
      };
    } else {
      return {
        containerPadding: 4,
        paperPadding: 3,
        avatarSize: 80,
        iconSize: 60,
        titleVariant: "h3",
        subtitleVariant: "h6",
        subtitleFontSize: '1.25rem',
        buttonPadding: 2,
        buttonFontSize: '1.1rem',
        chipSize: "medium",
        spacing: 4
      };
    }
  };

  const styles = getResponsiveStyles();

  // --- Logged In View ---
  if (isAuthenticated && user) {
    return (
      <Container maxWidth="sm">
        <Box
          display="flex"
          minHeight="100vh"
          justifyContent="center"
          alignItems="center"
          py={styles.containerPadding}
          px={isMobile ? styles.containerPadding : 0}
        >
          <Grow in={true}>
            <Paper
              sx={{
                p: styles.paperPadding,
                textAlign: 'center',
                width: '100%',
                maxWidth: isMobile ? '100%' : '400px'
              }}
            >
              <Avatar
                sx={{
                  width: styles.avatarSize,
                  height: styles.avatarSize,
                  mx: 'auto',
                  mb: styles.spacing,
                  background: (theme) => `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.primary.main})`
                }}
              >
                <VerifiedUserIcon sx={{ fontSize: styles.iconSize * 0.625 }} />
              </Avatar>
              <AnimatedGradientText
                variant={isMobile ? "h5" : "h4"}
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                  mb: isMobile ? 1 : 2
                }}
              >
                Chào mừng {user.role_id === '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a' || user.role_id === '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b' ? 'Admin' : 'Nhân viên'},
              </AnimatedGradientText>
              <Typography
                variant={isMobile ? "h6" : "h5"}
                sx={{
                  mb: styles.spacing,
                  fontWeight: 'medium'
                }}
              >
                {user.ho_ten || 'Nhân viên'}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{
                  mb: styles.spacing,
                  fontWeight: 'medium'
                }}
              >
                Chức vụ: {getPositionDisplayName()}
              </Typography>
              <Box
                display="flex"
                flexDirection="column"
                gap={styles.spacing * 0.5}
                mb={styles.spacing}
              >
                <Chip
                  label={`Ví: ${connectedWallet?.slice(0, 6)}...${connectedWallet?.slice(-4)}`}
                  variant="outlined"
                  size={styles.chipSize}
                  sx={{
                    background: 'linear-gradient(135deg, #f6851b 0%, #f7931e 100%)',
                    color: 'white',
                    '& .MuiChip-label': {
                      fontWeight: 'bold'
                    }
                  }}
                />
                <Chip
                  label={`Chức vụ: ${getPositionDisplayName()}`}
                  variant="outlined"
                  size={styles.chipSize}
                />
                {user.role_id !== SUPER_ADMIN_ROLE && (
                  <Chip
                    label={`Phòng ban: ${getDepartmentDisplayName()}`}
                    variant="outlined"
                    size={styles.chipSize}
                  />
                )}
              </Box>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={1}
                flexDirection={isMobile ? "column" : "row"}
              >
                <CircularProgress size={isMobile ? 20 : 24} />
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                >
                  Đang vào không gian làm việc...
                </Typography>
              </Box>

              <Box mt={styles.spacing} display="flex" justifyContent="center">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    authService.logout();
                    setIsAuthenticated(false);
                    setUser(null);
                    setConnectedWallet(null);
                    setError('');
                    setSuccess('');
                  }}
                  sx={{
                    fontSize: isMobile ? '0.8rem' : '0.875rem',
                    borderColor: 'text.secondary',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: 'error.main',
                      color: 'error.main'
                    }
                  }}
                >
                  Đăng xuất
                </Button>
              </Box>
            </Paper>
          </Grow>
        </Box>
      </Container>
    );
  }

  // --- Login View ---
  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
        py={styles.containerPadding}
        px={isMobile ? styles.containerPadding : 0}
      >
        <Fade in={true} timeout={1000}>
          <Box
            textAlign="center"
            mb={styles.spacing}
            px={isMobile ? styles.containerPadding : 0}
          >
            <Avatar
              sx={{
                width: styles.avatarSize,
                height: styles.avatarSize,
                mx: 'auto',
                mb: styles.spacing,
                background: 'transparent'
              }}
            >
              <LanguageIcon
                color="primary"
                sx={{
                  fontSize: styles.iconSize,
                  filter: `drop-shadow(0 0 10px ${theme.palette.primary.main})`
                }}
              />
            </Avatar>
            <AnimatedGradientText
              variant={styles.titleVariant}
              component="h1"
              sx={{
                fontWeight: 'bold',
                mb: isMobile ? 0.5 : 1
              }}
            >
              Cổng Thông Tin Nhân Sự
            </AnimatedGradientText>
            <Typography
              variant={styles.subtitleVariant}
              color="text.secondary"
              sx={{
                fontWeight: 400,
                fontSize: styles.subtitleFontSize
              }}
            >
              Nền tảng quản trị nhân sự phi tập trung
            </Typography>
          </Box>
        </Fade>

        <Grow in={true} timeout={1500}>
          <Paper
            sx={{
              p: styles.paperPadding,
              width: '100%',
              textAlign: 'center',
              maxWidth: isMobile ? '100%' : '400px'
            }}
          >
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: styles.spacing }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="login tabs">
                <Tab label="MetaMask" />
                <Tab label="QR Code" />
              </Tabs>
            </Box>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: styles.spacing,
                  fontSize: isMobile ? '0.85rem' : '0.95rem'
                }}
              >
                {error}
              </Alert>
            )}
            {success && (
              <Alert
                severity="success"
                sx={{
                  mb: styles.spacing,
                  fontSize: isMobile ? '0.85rem' : '0.95rem'
                }}
              >
                {success}
              </Alert>
            )}

            {tabValue === 0 && (
              <>
                <Typography
                  variant={isMobile ? "h6" : "h5"}
                  sx={{
                    mb: isMobile ? 0.5 : 1,
                    fontWeight: 'medium'
                  }}
                >
                  Đăng nhập an toàn
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{
                    mb: styles.spacing,
                    fontSize: isMobile ? '0.9rem' : '1rem'
                  }}
                >
                  Sử dụng ví điện tử Web3 của bạn để xác thực.
                </Typography>

                <Button
                  variant="contained"
                  size={isMobile ? "large" : "large"}
                  fullWidth
                  onClick={handleConnectWallet}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : (
                    <Box
                      component="img"
                      src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                      alt="MetaMask Fox"
                      sx={{
                        width: isMobile ? 24 : 28,
                        height: isMobile ? 24 : 28,
                        filter: 'none' // Keep original MetaMask orange color
                      }}
                    />
                  )}
                  endIcon={<ChevronRightIcon />}
                  sx={{
                    py: styles.buttonPadding,
                    fontSize: styles.buttonFontSize,
                    mb: styles.spacing,
                    background: 'linear-gradient(135deg, #f6851b 0%, #f7931e 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #e6750f 0%, #e8850f 100%)',
                    },
                    boxShadow: '0 4px 14px 0 rgba(246, 133, 27, 0.39)',
                    '&:hover': {
                      boxShadow: '0 6px 20px rgba(246, 133, 27, 0.5)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.3s ease-in-out'
                  }}
                >
                  {loading ? 'Đang xác thực...' : 'Kết Nối Ví MetaMask'}
                </Button>

                <Box mt={styles.spacing} display="flex" justifyContent="center">
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => setGuideModalOpen(true)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: 'text.secondary',
                      textDecorationColor: 'text.secondary',
                      fontSize: isMobile ? '0.85rem' : '0.875rem'
                    }}
                  >
                    <HelpIcon fontSize="small" />
                    Chưa có ví? Hướng dẫn cài đặt
                  </Link>
                </Box>
              </>
            )}

            {tabValue === 1 && (
              <>
                <Typography
                  variant={isMobile ? "h6" : "h5"}
                  sx={{
                    mb: isMobile ? 0.5 : 1,
                    fontWeight: 'medium'
                  }}
                >
                  Đăng nhập bằng QR
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{
                    mb: styles.spacing,
                    fontSize: isMobile ? '0.9rem' : '1rem'
                  }}
                >
                  Quét mã QR từ ứng dụng nhân viên để đăng nhập nhanh chóng và an toàn.
                </Typography>

                <Button
                  variant="contained"
                  size={isMobile ? "large" : "large"}
                  fullWidth
                  onClick={() => setQrScannerOpen(true)}
                  disabled={scanningQr}
                  startIcon={scanningQr ? <CircularProgress size={20} color="inherit" /> : <QrCodeScannerIcon />}
                  sx={{
                    py: styles.buttonPadding,
                    fontSize: styles.buttonFontSize,
                    mb: styles.spacing,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6b4190 100%)',
                    },
                    boxShadow: '0 4px 14px 0 rgba(102, 126, 234, 0.39)',
                    '&:hover': {
                      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.3s ease-in-out'
                  }}
                >
                  {scanningQr ? 'Đang xử lý...' : 'Quét Mã QR'}
                </Button>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: isMobile ? '0.8rem' : '0.875rem'
                  }}
                >
                  QR code có hiệu lực vĩnh viễn cho đến khi tạo mã mới và chứa thông tin xác thực blockchain.
                </Typography>
              </>
            )}
          </Paper>
        </Grow>

        {/* QR Scanner Dialog */}
        <Dialog
          open={qrScannerOpen}
          onClose={() => setQrScannerOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Quét Mã QR</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <QrScanner
                onScan={handleQrScan}
                onError={(error) => console.log(error)}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" align="center">
              Hướng camera về phía mã QR để quét
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQrScannerOpen(false)}>Đóng</Button>
          </DialogActions>
        </Dialog>

        <Fade in={true} timeout={2000}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: styles.spacing,
              textAlign: 'center',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              px: isMobile ? styles.containerPadding : 0
            }}
          >
            © {new Date().getFullYear()} - Nền tảng được xây dựng trên công nghệ Blockchain.
          </Typography>
        </Fade>
      </Box>
      <MetaMaskGuideModal open={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </Container>
  );
}

export default LoginPage;
