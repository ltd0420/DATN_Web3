import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Box, Link, Alert, IconButton, LinearProgress, useTheme, useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  Launch as LaunchIcon,
  ArrowBack,
  HelpOutline,
  Download,
  AddCard,
  Password,
  DoneAll,
  Celebration
} from '@mui/icons-material';
// Để có hiệu ứng mượt mà, hãy thêm framer-motion vào dự án của bạn:
// npm install framer-motion
import { motion, AnimatePresence } from 'framer-motion';

// --- Cấu trúc dữ liệu cho các bước, bao gồm cả icon ---
const steps = [
  {
    icon: <HelpOutline sx={{ fontSize: 40, color: 'primary.main' }} />,
    label: 'MetaMask là gì?',
    description: `MetaMask là ví điện tử an toàn, hoạt động như một tiện ích mở rộng trên trình duyệt. Nó là cầu nối giúp bạn tương tác an toàn với các ứng dụng Web3, thay thế cho mật khẩu truyền thống.`,
  },
  {
    icon: <Download sx={{ fontSize: 40, color: 'primary.main' }} />,
    label: 'Bước 1: Tải và Cài đặt',
    description: (
      <>
        Truy cập trang chính thức tại{' '}
        <Link href="https://metamask.io" target="_blank" rel="noopener noreferrer" sx={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
          metamask.io <LaunchIcon sx={{ ml: 0.5, fontSize: 'inherit' }} />
        </Link>
        . Nhấp "Download" và làm theo hướng dẫn để thêm tiện ích vào trình duyệt.
      </>
    ),
  },
  {
    icon: <AddCard sx={{ fontSize: 40, color: 'primary.main' }} />,
    label: 'Bước 2: Tạo Ví Mới',
    description: `Sau khi cài đặt, mở MetaMask và chọn "Tạo một ví mới". Đồng ý với các điều khoản và tạo một mật khẩu mạnh để bảo vệ ví trên thiết bị này.`,
  },
  {
    icon: <Password sx={{ fontSize: 40, color: 'primary.main' }} />,
    label: 'Bước 3: Lưu Cụm Từ Khôi Phục (Cực kỳ Quan Trọng!)',
    description: (
      <>
        <Alert severity="warning" variant="outlined" sx={{ mb: 2, borderColor: 'warning.main' }}>
          <Typography fontWeight="bold">Đây là chìa khóa duy nhất để khôi phục ví của bạn!</Typography>
        </Alert>
        Hệ thống sẽ cung cấp "Cụm Từ Khôi Phục Bí Mật" gồm 12 từ.
        <Typography component="span" fontWeight="bold" color="error.main"> Hãy viết 12 từ này ra giấy và cất ở nơi an toàn.</Typography>
        Tuyệt đối không lưu trữ online hoặc chia sẻ cho bất kỳ ai.
      </>
    ),
  },
  {
    icon: <DoneAll sx={{ fontSize: 40, color: 'primary.main' }} />,
    label: 'Bước 4: Hoàn Tất và Kết Nối',
    description: `Sau khi xác nhận Cụm từ khôi phục, ví của bạn đã sẵn sàng. Bây giờ, bạn có thể đóng cửa sổ này và nhấp vào nút "Kết Nối Ví MetaMask" trên trang đăng nhập.`,
  },
];

// --- Component chính ---
const MetaMaskGuideModal = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmall = useMediaQuery(theme.breakpoints.down(400));
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => setActiveStep((prev) => Math.min(prev + 1, steps.length));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));
  const handleResetAndClose = () => {
    setActiveStep(0);
    onClose();
  };

  const progress = (activeStep / (steps.length -1)) * 100;

  // --- Hiệu ứng chuyển động cho nội dung ---
  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
    }),
  };
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection) => {
    setDirection(newDirection);
    if (newDirection > 0) handleNext();
    else handleBack();
  };

  // --- Responsive styles ---
  const getResponsiveStyles = () => {
    if (isVerySmall) {
      return {
        dialogPadding: 1,
        titleVariant: "h6",
        titleFontSize: '1rem',
        contentHeight: 'calc(100vh - 120px)',
        iconSize: 28,
        stepTitleVariant: "body1",
        stepTitleFontSize: '0.95rem',
        descriptionFontSize: '0.85rem',
        buttonMinHeight: '40px',
        buttonFontSize: '0.85rem',
        spacing: 1
      };
    } else if (isMobile) {
      return {
        dialogPadding: 2,
        titleVariant: "h6",
        titleFontSize: '1.1rem',
        contentHeight: 'calc(100vh - 140px)',
        iconSize: 32,
        stepTitleVariant: "h6",
        stepTitleFontSize: '1rem',
        descriptionFontSize: '0.9rem',
        buttonMinHeight: '44px',
        buttonFontSize: '0.9rem',
        spacing: 1.5
      };
    } else {
      return {
        dialogPadding: 3,
        titleVariant: "h5",
        titleFontSize: '1.25rem',
        contentHeight: 350,
        iconSize: 40,
        stepTitleVariant: "h6",
        stepTitleFontSize: '1.25rem',
        descriptionFontSize: '1rem',
        buttonMinHeight: 'auto',
        buttonFontSize: '0.95rem',
        spacing: 2
      };
    }
  };

  const styles = getResponsiveStyles();

  return (
    <Dialog
      open={open}
      onClose={handleResetAndClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          margin: isMobile ? 0 : 2,
          maxHeight: isMobile ? '100vh' : '90vh',
          borderRadius: isMobile ? 0 : 2
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: styles.dialogPadding,
          pb: 1
        }}
      >
        <Typography
          variant={styles.titleVariant}
          component="div"
          sx={{
            fontWeight: 'bold',
            fontSize: styles.titleFontSize,
            flex: 1,
            mr: 2
          }}
        >
          Hướng Dẫn Cài Đặt MetaMask
        </Typography>
        <IconButton onClick={handleResetAndClose} size={isMobile ? "small" : "medium"}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* --- Thanh tiến trình --- */}
      <Box sx={{ px: styles.dialogPadding, pb: 1 }}>
        <LinearProgress variant="determinate" value={progress} />
      </Box>

      <DialogContent
        sx={{
          p: styles.dialogPadding,
          height: styles.contentHeight,
          overflow: 'hidden',
          // FIX: Thêm `position: 'relative'` để các animation con được định vị chính xác bên trong component này.
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
            {activeStep < steps.length ? (
                // --- Nội dung các bước ---
                <motion.div
                    key={activeStep}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: 'spring', stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 },
                    }}
                    style={{
                        position: 'absolute',
                        // Thêm các thuộc tính left, top, right, bottom để đảm bảo nó nằm gọn trong padding của DialogContent
                        top: theme.spacing(styles.dialogPadding),
                        left: theme.spacing(styles.dialogPadding),
                        right: theme.spacing(styles.dialogPadding),
                        bottom: theme.spacing(styles.dialogPadding),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      textAlign="center"
                      sx={{
                        height: '100%',
                        justifyContent: 'center',
                        maxWidth: '100%'
                      }}
                    >
                        <Box sx={{
                          p: isMobile ? 1.5 : 2,
                          borderRadius: '50%',
                          background: (theme) => `rgba(${theme.palette.primary.mainChannel} / 0.1)`,
                          mb: styles.spacing,
                          display: 'inline-flex',
                          flexShrink: 0
                        }}>
                          {React.cloneElement(steps[activeStep].icon, {
                             sx: {
                               fontSize: styles.iconSize,
                               color: 'primary.main'
                             }
                          })}
                        </Box>
                        <Typography
                          variant={styles.stepTitleVariant}
                          sx={{
                            fontWeight: 'bold',
                            mb: styles.spacing,
                            fontSize: styles.stepTitleFontSize,
                            textAlign: 'center'
                          }}
                        >
                            {steps[activeStep].label}
                        </Typography>
                        <Box sx={{
                          flex: 1,
                          overflowY: 'auto', // Cho phép cuộn nếu nội dung dài
                          width: '100%',
                        }}>
                          <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{
                              fontSize: styles.descriptionFontSize,
                              lineHeight: isMobile ? 1.5 : 1.7,
                              textAlign: 'center'
                            }}
                          >
                              {steps[activeStep].description}
                          </Typography>
                        </Box>
                    </Box>
                </motion.div>
            ) : (
                // --- Màn hình hoàn thành ---
                <motion.div
                    key="completion"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%'
                    }}
                >
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      textAlign="center"
                      sx={{
                        height: '100%',
                        justifyContent: 'center',
                        px: isMobile ? 1 : 0,
                        maxWidth: '100%'
                      }}
                    >
                         <Celebration sx={{
                           fontSize: isMobile ? 48 : 60,
                           color: 'success.main',
                           mb: styles.spacing,
                           flexShrink: 0
                         }} />
                         <Typography
                           variant={isMobile ? "h6" : "h5"}
                           sx={{
                             fontWeight: 'bold',
                             mb: isMobile ? 0.5 : 1,
                             fontSize: isMobile ? '1.1rem' : '1.25rem',
                             textAlign: 'center'
                           }}
                         >
                           Bạn đã sẵn sàng!
                         </Typography>
                         <Typography
                           color="text.secondary"
                           sx={{
                             fontSize: styles.descriptionFontSize,
                             textAlign: 'center'
                           }}
                         >
                            Giờ bạn có thể đóng cửa sổ này và bắt đầu đăng nhập vào hệ thống.
                         </Typography>
                    </Box>
                </motion.div>
            )}
        </AnimatePresence>
      </DialogContent>

      <DialogActions
        sx={{
          p: styles.dialogPadding,
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column-reverse' : 'row', // Đảo ngược nút trên mobile cho UX tốt hơn
          gap: isMobile ? 1 : 0,
          flexShrink: 0
        }}
      >
        <Button
          onClick={() => paginate(-1)}
          disabled={activeStep === 0}
          startIcon={<ArrowBack />}
          fullWidth={isMobile}
          size={isMobile ? "medium" : "medium"}
          sx={{
            minHeight: styles.buttonMinHeight,
            fontSize: styles.buttonFontSize
          }}
        >
          Quay lại
        </Button>

        {activeStep < steps.length ? (
          <Button
            variant="contained"
            // FIX: Đơn giản hóa onClick để đảm bảo logic nhất quán
            onClick={() => paginate(1)}
            color={activeStep === steps.length - 1 ? "success" : "primary"}
            fullWidth={isMobile}
            size={isMobile ? "medium" : "medium"}
            sx={{
              minHeight: styles.buttonMinHeight,
              fontSize: styles.buttonFontSize
            }}
          >
            {activeStep === steps.length - 1 ? 'Đã hiểu, Hoàn tất' : 'Tiếp theo'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleResetAndClose}
            fullWidth={isMobile}
            size={isMobile ? "medium" : "medium"}
            sx={{
              minHeight: styles.buttonMinHeight,
              fontSize: styles.buttonFontSize
            }}
          >
            Đóng và Đăng nhập
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MetaMaskGuideModal;
