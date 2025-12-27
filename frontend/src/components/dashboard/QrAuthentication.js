import React, { useState, useEffect, useRef } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Button, Chip,
  Alert, CircularProgress, useTheme, useMediaQuery, Dialog,
  DialogTitle, DialogContent, DialogActions, Paper, TextField,
  FormControl, InputLabel, Select, MenuItem, Divider
} from '@mui/material';
import {
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  AccountBalanceWallet as WalletIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';
import apiService from '../../services/apiService';

function QrAuthentication({ user, employeeData }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [blockchainVerified, setBlockchainVerified] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    if (user?.employee_did) {
      fetchQrData();
      // Check if MetaMask is available
      if (window.ethereum) {
        checkWalletConnection();
      }
    }
  }, [user]);

  const checkWalletConnection = async () => {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (error) {
      console.error('Check wallet connection error:', error);
    }
  };

  const connectWallet = async () => {
    try {
      setConnectingWallet(true);
      setError('');

      if (!window.ethereum) {
        throw new Error('MetaMask không được cài đặt. Vui lòng cài đặt MetaMask để sử dụng tính năng blockchain.');
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      setWalletAddress(address);

      // Update user wallet address in backend
      await apiService.updateUserWallet(user.employee_did, address);

      return address;
    } catch (error) {
      console.error('Connect wallet error:', error);
      setError('Không thể kết nối ví. Vui lòng thử lại.');
    } finally {
      setConnectingWallet(false);
    }
  };

  const fetchQrData = async () => {
    try {
      setLoading(true);
      setError('');

      const { employee_did } = user;
      const response = await apiService.getQrCode(employee_did);
      setQrData(response);

      // Check blockchain verification status
      if (response?.token_id && response?.transaction_hash) {
        setBlockchainVerified(true);
      }
    } catch (err) {
      console.error('Fetch QR data error:', err);
      // Don't show error for missing QR data, it's normal for new users
    } finally {
      setLoading(false);
    }
  };

  const generateQrCodeData = async () => {
    // Check if user is logged in and has required data
    if (!user?.employee_did) {
      throw new Error('Bạn cần đăng nhập để tạo mã QR.');
    }

    // Ensure wallet is connected
    let currentWalletAddress = walletAddress;
    if (!currentWalletAddress) {
      currentWalletAddress = await connectWallet();
      if (!currentWalletAddress) {
        throw new Error('Cần kết nối ví để tạo mã QR blockchain.');
      }
    }

    // Luôn lấy QR mới nhất từ backend để đảm bảo trùng khớp với dữ liệu dùng để đăng nhập
    let currentQrData;
    try {
      currentQrData = await apiService.getQrCode(user.employee_did);
      setQrData(currentQrData);
    } catch (err) {
      throw new Error('Không thể tải thông tin QR từ server. Vui lòng thử lại.');
    }

    // Generate QR code data with blockchain information
    const qrCodeData = {
      qr_code_id: currentQrData.qr_code_id,
      qr_hash: currentQrData.qr_hash,
      employee_did: user.employee_did,
      wallet_address: currentWalletAddress,
      timestamp: new Date().toISOString(),
      type: 'login_auth',
      blockchain: {
        network: currentQrData.network || 'ethereum',
        standard: 'ERC-721',
        contract_address: currentQrData.contract_address || '0x0000000000000000000000000000000000000000',
        token_id: currentQrData.token_id,
        transaction_hash: currentQrData.transaction_hash
      }
    };

    return JSON.stringify(qrCodeData);
  };

  const generateQrCodeImage = async () => {
    try {
      setGeneratingQr(true);
      setError('');

      const qrDataString = await generateQrCodeData();
      const qrImage = await QRCode.toDataURL(qrDataString, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeImage(qrImage);
      return qrImage;
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError(err.message || 'Không thể tạo mã QR. Vui lòng thử lại.');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleGenerateNewQr = async () => {
    // Prevent multiple simultaneous requests
    if (isGeneratingRef.current) {
      return;
    }

    try {
      isGeneratingRef.current = true;
      setGeneratingQr(true);
      setError('');

      // Ensure wallet is connected
      let currentWalletAddress = walletAddress;
      if (!currentWalletAddress) {
        currentWalletAddress = await connectWallet();
        if (!currentWalletAddress) {
          isGeneratingRef.current = false;
          setGeneratingQr(false);
          return;
        }
      }

      // Generate new QR code from backend with blockchain integration
      const newQrData = await apiService.generateNewQrCode(user.employee_did, currentWalletAddress);

      // Check if account is locked due to too many QR generations
      if (newQrData.locked) {
        setError('Bạn đã tạo QR code quá 3 lần trong ngày hôm nay. Tài khoản sẽ bị tạm khóa để bảo mật.');
        isGeneratingRef.current = false;
        setGeneratingQr(false);
        return;
      }

      setQrData(newQrData);

      // Check if blockchain verification was successful
      if (newQrData.token_id && newQrData.transaction_hash) {
        setBlockchainVerified(true);
      }

      // Generate new QR image
      await generateQrCodeImage();

      // Refresh QR data display
      await fetchQrData();
    } catch (err) {
      console.error('Generate new QR error:', err);
      
      // Handle 429 Too Many Requests specifically
      if (err.response?.status === 429) {
        const errorMessage = err.response?.data?.message || 'Bạn đã tạo QR code quá nhiều lần. Vui lòng thử lại sau.';
        setError(errorMessage);
      } else if (err.response?.data?.locked) {
        setError('Bạn đã tạo QR code quá 3 lần trong ngày hôm nay. Tài khoản sẽ bị tạm khóa để bảo mật.');
      } else {
        setError(err.response?.data?.message || 'Không thể tạo mã QR mới. Vui lòng thử lại.');
      }
    } finally {
      isGeneratingRef.current = false;
      setGeneratingQr(false);
    }
  };

  const handleDownloadQr = async () => {
    try {
      // Luôn tạo lại QR từ dữ liệu mới nhất để đảm bảo QR tải ở ngoài
      // và QR tải ở trong popup hoàn toàn trùng nhau.
      const qrImage = await generateQrCodeImage();

      if (!qrImage) {
        throw new Error('Không thể tạo mã QR để tải xuống.');
      }

      const link = document.createElement('a');
      link.href = qrImage;
      link.download = `qr-blockchain-${user.employee_did}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading QR code:', err);
      setError(err.message || 'Không thể tải xuống mã QR. Vui lòng thử lại.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Hoạt động':
        return 'success';
      case 'Tạm khóa':
        return 'warning';
      case 'Đã thu hồi':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Hoạt động':
        return <CheckCircleIcon />;
      case 'Tạm khóa':
        return <ScheduleIcon />;
      case 'Đã thu hồi':
        return <ErrorIcon />;
      default:
        return <QrCodeIcon />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        QR Code Xác thực Blockchain
      </Typography>

      {error && (
        <Alert 
          severity={error.includes('quá 3 lần') || error.includes('429') ? 'warning' : 'error'} 
          sx={{ mb: 3 }}
          onClose={() => setError('')}
        >
          <Typography variant="body1" fontWeight="medium">
            {error}
          </Typography>
          {(error.includes('quá 3 lần') || error.includes('429')) && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Bạn có thể tạo lại QR code vào ngày mai. Giới hạn: 3 lần/ngày để đảm bảo bảo mật.
            </Typography>
          )}
        </Alert>
      )}

      {/* Wallet Connection Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            <WalletIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Kết nối Ví Blockchain
          </Typography>

          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <TextField
              label="Địa chỉ ví"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              disabled
              size="small"
              sx={{ minWidth: 300 }}
            />

            <Button
              variant="contained"
              startIcon={connectingWallet ? <CircularProgress size={20} /> : <WalletIcon />}
              onClick={connectWallet}
              disabled={connectingWallet}
              size="small"
            >
              {connectingWallet ? 'Đang kết nối...' : walletAddress ? 'Đã kết nối' : 'Kết nối MetaMask'}
            </Button>

            {blockchainVerified && (
              <Chip
                label="Đã xác thực Blockchain"
                color="success"
                icon={<VerifiedIcon />}
                size="small"
              />
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Kết nối ví MetaMask để tạo mã QR được bảo mật bằng công nghệ blockchain và NFT.
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* QR Code Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Thẻ QR Xác thực Blockchain
              </Typography>

              <Box textAlign="center" mb={3}>
                {generatingQr ? (
                  <CircularProgress size={60} />
                ) : qrCodeImage ? (
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      display: 'inline-block',
                      borderRadius: 2,
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onClick={() => setQrDialogOpen(true)}
                  >
                    <img
                      src={qrCodeImage}
                      alt="QR Code"
                      style={{
                        width: '200px',
                        height: '200px',
                        display: 'block'
                      }}
                    />
                    {blockchainVerified && (
                      <VerifiedIcon
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: 'success.main',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          padding: '2px'
                        }}
                      />
                    )}
                  </Paper>
                ) : (
                  <Paper
                    elevation={3}
                    sx={{
                      p: 3,
                      display: 'inline-block',
                      borderRadius: 2,
                      background: `linear-gradient(45deg, ${theme.palette.primary.light}, ${theme.palette.secondary.light})`,
                      cursor: 'pointer'
                    }}
                    onClick={async () => {
                      setQrDialogOpen(true);
                      if (!qrCodeImage) {
                        await generateQrCodeImage();
                      }
                    }}
                  >
                    <QrCodeIcon
                      sx={{
                        fontSize: 120,
                        color: 'white',
                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                      }}
                    />
                  </Paper>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Nhấn để xem chi tiết
                </Typography>
              </Box>

              <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadQr}
                  size="small"
                  disabled={!qrCodeImage}
                >
                  Tải xuống
                </Button>
                <Button
                  variant="contained"
                  startIcon={<QrCodeIcon />}
                  onClick={handleGenerateNewQr}
                  disabled={generatingQr || !walletAddress || (qrData?.so_lan_tao_qr >= 3)}
                  size="small"
                >
                  {generatingQr ? 'Đang tạo...' : 'Tạo QR mới'}
                </Button>
              </Box>
              {qrData?.so_lan_tao_qr !== undefined && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                  Đã tạo: {qrData.so_lan_tao_qr}/3 lần trong ngày
                  {qrData.so_lan_tao_qr >= 3 && ' (Đã đạt giới hạn)'}
                </Typography>
              )}

              {!walletAddress && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Vui lòng kết nối ví MetaMask để tạo mã QR blockchain.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Status & Info Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Thông tin thẻ QR Blockchain
              </Typography>

              <Box display="flex" flexDirection="column" gap={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                    Trạng thái:
                  </Typography>
                  <Chip
                    label={qrData?.trang_thai || 'Chưa tạo'}
                    color={getStatusColor(qrData?.trang_thai)}
                    size="small"
                    icon={getStatusIcon(qrData?.trang_thai)}
                  />
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                    Mã thẻ:
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {qrData?.qr_code_id || `Chưa tạo`}
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                    Ngày cấp:
                  </Typography>
                  <Typography variant="body2">
                    {qrData?.ngay_cap ? new Date(qrData.ngay_cap).toLocaleDateString('vi-VN') : 'Chưa cấp'}
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                    Lần sử dụng:
                  </Typography>
                  <Typography variant="body2">
                    {qrData?.so_lan_su_dung || 0} lần
                  </Typography>
                </Box>

                {qrData?.transaction_hash && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                      TX Hash:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>
                      {qrData.transaction_hash.substring(0, 10)}...{qrData.transaction_hash.substring(qrData.transaction_hash.length - 8)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Usage Instructions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Hướng dẫn sử dụng QR Blockchain
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Bảo mật Blockchain
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Mã QR được mã hóa bằng chữ ký số từ ví của bạn<br/>
                      • Mỗi mã QR là một NFT duy nhất trên blockchain<br/>
                      • Xác thực on-chain đảm bảo tính toàn vẹn dữ liệu
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      <VerifiedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Quy trình sử dụng
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Kết nối ví MetaMask trước khi tạo QR<br/>
                      • Tạo mã QR và xác nhận transaction trên blockchain<br/>
                      • Sử dụng mã QR để đăng nhập nhanh và bảo mật
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* QR Code Detail Dialog */}
      <Dialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Chi tiết mã QR Blockchain
        </DialogTitle>
        <DialogContent>
          <Box textAlign="center" mb={2}>
            {generatingQr ? (
              <CircularProgress size={60} />
            ) : qrCodeImage ? (
              <Paper
                elevation={3}
                sx={{
                  p: 2,
                  display: 'inline-block',
                  borderRadius: 2,
                  backgroundColor: 'white',
                  position: 'relative'
                }}
              >
                <img
                  src={qrCodeImage}
                  alt="QR Code"
                  style={{
                    width: '256px',
                    height: '256px',
                    display: 'block'
                  }}
                />
                {blockchainVerified && (
                  <VerifiedIcon
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: 'success.main',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      padding: '2px',
                      fontSize: '2rem'
                    }}
                  />
                )}
              </Paper>
            ) : (
              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  display: 'inline-block',
                  borderRadius: 2,
                  background: `linear-gradient(45deg, ${theme.palette.primary.light}, ${theme.palette.secondary.light})`
                }}
              >
                <QrCodeIcon
                  sx={{
                    fontSize: 200,
                    color: 'white',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                  }}
                />
              </Paper>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
            Mã QR này được bảo mật bằng công nghệ blockchain và chứa thông tin định danh NFT của bạn.
          </Typography>

          {/* Đã lược bỏ phần chi tiết Blockchain (TokenID, Network, Contract, TX Hash)
              để popup gọn hơn theo yêu cầu người dùng. */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>
            Đóng
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadQr}
            disabled={!qrCodeImage}
          >
            Tải xuống
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default QrAuthentication;
