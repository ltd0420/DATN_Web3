import React, { useRef, useEffect, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import {
  Box, Tabs, Tab, Button, Typography, Paper,
  useTheme, useMediaQuery
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Upload as UploadIcon
} from '@mui/icons-material';

function QrScanner({ onScan, onError }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const videoRef = useRef(null);
  const codeReader = useRef(null);
  const fileInputRef = useRef(null);
  const [tabValue, setTabValue] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);

  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader();

    if (tabValue === 0 && cameraPermission && videoRef.current) {
      setScanning(true);
      codeReader.current.decodeFromVideoDevice(
        null,
        videoRef.current,
        (result, err) => {
          if (result) {
            onScan(result.text);
            setScanning(false);
            codeReader.current.reset();
          }
          if (err && err.name !== 'NotFoundException' && onError) {
            onError(err);
          }
        }
      );
    } else {
      setScanning(false);
      if (codeReader.current) {
        codeReader.current.reset();
      }
    }

    return () => {
      if (codeReader.current) {
        codeReader.current.reset();
      }
    };
  }, [tabValue, cameraPermission, onScan, onError]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    if (newValue === 0) {
      setCameraPermission(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      // Check if running on HTTPS (required for camera access)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        if (onError) onError(new Error('Camera chỉ hoạt động trên HTTPS. Vui lòng truy cập qua HTTPS hoặc localhost.'));
        return;
      }

      await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission(true);
    } catch (err) {
      console.error('Camera permission error:', err);
      let errorMessage = 'Không thể truy cập camera. ';
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Vui lòng cho phép quyền truy cập camera trong trình duyệt.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Không tìm thấy camera trên thiết bị này.';
      } else {
        errorMessage += 'Vui lòng kiểm tra cài đặt trình duyệt.';
      }
      if (onError) onError(new Error(errorMessage));
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
          try {
            const result = await codeReader.current.decodeFromImage(img);
            if (result) {
              onScan(result.text);
            } else {
              if (onError) onError(new Error('Không tìm thấy mã QR trong ảnh'));
            }
          } catch (err) {
            if (onError) onError(err);
          } finally {
            URL.revokeObjectURL(imageUrl);
          }
        };
        img.src = imageUrl;
      } catch (err) {
        if (onError) onError(err);
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Paper elevation={2} sx={{ p: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="qr scanner tabs">
          <Tab
            icon={<CameraIcon />}
            label={isMobile ? "Camera" : "Quét Camera"}
            sx={{ minHeight: 48 }}
          />
          <Tab
            icon={<UploadIcon />}
            label={isMobile ? "Upload" : "Upload Ảnh"}
            sx={{ minHeight: 48 }}
          />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {tabValue === 0 && (
            <Box textAlign="center">
              {!cameraPermission ? (
                <Box>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Cần quyền truy cập camera để quét mã QR
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CameraIcon />}
                    onClick={requestCameraPermission}
                    color="primary"
                  >
                    Cho phép truy cập Camera
                  </Button>
                </Box>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      border: '2px solid #ccc',
                      borderRadius: '8px'
                    }}
                    playsInline
                    muted
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {scanning ? 'Đang quét...' : 'Camera đang tắt'}
                  </Typography>
                </>
              )}
            </Box>
          )}

          {tabValue === 1 && (
            <Box textAlign="center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={handleUploadClick}
                sx={{ mt: 2 }}
              >
                Chọn ảnh QR
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Chọn file ảnh chứa mã QR để quét
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default QrScanner;
