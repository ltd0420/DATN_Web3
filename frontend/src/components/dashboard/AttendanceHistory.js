import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Button, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Alert, CircularProgress, useTheme, useMediaQuery, TextField,
  InputAdornment, IconButton, Tooltip, Fab, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Link, Divider, List, ListItem, ListItemText,
  ListItemIcon, Accordion, AccordionSummary, AccordionDetails,
  Avatar, LinearProgress, Stack
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AccessTime as AccessTimeIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  QrCode as QrCodeIcon,
  Verified as VerifiedIcon,
  Link as LinkIcon,
  ExpandMore as ExpandMoreIcon,
  GetApp as ExportIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  LockClock as LockClockIcon,
  Work as WorkIcon,
  AccountBalanceWallet as WalletIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  UploadFile as UploadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi } from 'date-fns/locale';
import { startOfMonth, endOfMonth } from 'date-fns';
import apiService from '../../services/apiService';
import QrScanner from '../QrScanner';
import * as XLSX from 'xlsx';

// Mặc định bật khóa checkout sau giờ quy định (17:30) trừ khi REACT_APP_CHECKOUT_LOCK_ENABLED = 'false'
const checkoutLockEnabled = process.env.REACT_APP_CHECKOUT_LOCK_ENABLED !== 'false';
const checkinLockEnabled = process.env.REACT_APP_CHECKIN_LOCK_ENABLED !== 'false';
const CHECKIN_START_MINUTES = Number(process.env.REACT_APP_CHECKIN_START_MINUTES || 6 * 60);
// Cho phép check-in đến 17:30 (5 giờ 30 chiều)
const CHECKIN_END_MINUTES = Number(
  process.env.REACT_APP_CHECKIN_END_MINUTES || (17 * 60 + 30)
);
// Khóa chức năng chấm công sau 17:30 (không cho tăng ca sau thời điểm này)
const CHECKOUT_LOCK_MINUTES = Number(
  process.env.REACT_APP_CHECKOUT_LOCK_MINUTES || (17 * 60 + 30)
);
// Đặt mốc tăng ca trùng với thời điểm khóa để đảm bảo không có giờ tăng ca
const OVERTIME_START_MINUTES = Number(
  process.env.REACT_APP_OVERTIME_START_MINUTES || (17 * 60 + 30)
);

const formatMinutesToLabel = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${suffix}`;
};

// Format date to YYYY-MM-DD using local timezone
const getLocalDateString = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function AttendanceHistory({ user, employeeData }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrAction, setQrAction] = useState('');
  const [smartContractLogs, setSmartContractLogs] = useState({});
  const [paymentAlert, setPaymentAlert] = useState(null);
  const [paymentProcessingId, setPaymentProcessingId] = useState(null);
  const [missedCheckoutDialogOpen, setMissedCheckoutDialogOpen] = useState(false);
  const [missedCheckoutDescription, setMissedCheckoutDescription] = useState('');
  const [missedCheckoutHours, setMissedCheckoutHours] = useState('');
  const [missedCheckoutEvidence, setMissedCheckoutEvidence] = useState('');
  const [missedCheckoutFiles, setMissedCheckoutFiles] = useState([]);

  // Filter states
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [dayTypeFilter, setDayTypeFilter] = useState('all');

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordDetails, setRecordDetails] = useState(null);

  useEffect(() => {
    fetchAttendanceData();
  }, [user]);

  const fetchAttendanceData = async (params = {}) => {
    try {
      setLoading(true);
      setError('');

      const { employee_did } = user;
      const response = await apiService.getAttendanceByEmployee(employee_did, params);

      const normalizedData = (response || []).map(record => {
        let normalizedDate = record.ngay;
        if (record.ngay) {
          // Normalize date to YYYY-MM-DD format, handling timezone correctly
          if (typeof record.ngay === 'string' && record.ngay.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Already in correct format
            normalizedDate = record.ngay;
          } else {
            // Parse date and format to YYYY-MM-DD (using local date, not UTC)
            const date = new Date(record.ngay);
            normalizedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          }
        }
        return {
          ...record,
          ngay: normalizedDate
        };
      });

      setAttendanceData(normalizedData);
      console.log('[fetchAttendanceData] Updated attendance data:', normalizedData.length, 'records');
    } catch (err) {
      const errorMessage = err.response?.data?.message ||
                          err.response?.data?.error ||
                          err.message ||
                          'Không thể tải dữ liệu chấm công. Vui lòng thử lại.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (qrCodeId = null) => {
    try {
      setCheckInLoading(true);
      setError('');

      // Ensure we're using today's date
      const currentDate = getLocalDateString();
      if (currentDate !== today) {
        setError('Chỉ có thể check-in cho ngày hôm nay. Vui lòng làm mới trang để cập nhật trạng thái.');
        await fetchAttendanceData();
        return;
      }

      if (todayRecord && todayRecord.gio_vao) {
        setError('Bạn đã check-in hôm nay rồi.');
        return;
      }

      if (!canCheckIn) {
        setError(`Check-in chỉ được phép từ ${checkInStartLabel} đến ${checkInEndLabel}.`);
        return;
      }

      const { employee_did } = user;
      const checkInData = {
        employee_did,
        ngay: currentDate, // Always use current date
        gio_vao: new Date().toTimeString().slice(0, 8),
        xac_thuc_qua: qrCodeId ? 'QR Code' : 'Web App'
      };

      if (qrCodeId) {
        checkInData.qr_code_id = qrCodeId;
      }

      const response = await apiService.checkIn(checkInData);
      console.log('[CheckIn] API Response:', response);
      
      // Immediately update the attendance data with the new check-in record
      if (response && response.gio_vao) {
        // Normalize the response date to match our format
        let normalizedDate = response.ngay;
        if (response.ngay) {
          if (typeof response.ngay === 'string' && response.ngay.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalizedDate = response.ngay;
          } else {
            const date = new Date(response.ngay);
            normalizedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          }
        }
        
        const normalizedRecord = {
          ...response,
          ngay: normalizedDate
        };
        
        console.log('[CheckIn] Normalized record:', normalizedRecord);
        console.log('[CheckIn] Current date:', currentDate);
        
        // Update the attendance data immediately using functional update
        setAttendanceData(prevData => {
          console.log('[CheckIn] Previous data length:', prevData.length);
          
          // Check if record already exists for today
          const existingIndex = prevData.findIndex(item => {
            if (!item.ngay) return false;
            let recordDateStr;
            if (typeof item.ngay === 'string' && item.ngay.match(/^\d{4}-\d{2}-\d{2}$/)) {
              recordDateStr = item.ngay;
            } else {
              const recordDate = new Date(item.ngay);
              recordDateStr = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
            }
            return recordDateStr === currentDate;
          });
          
          console.log('[CheckIn] Existing index:', existingIndex);
          
          if (existingIndex >= 0) {
            // Update existing record
            const updated = [...prevData];
            updated[existingIndex] = normalizedRecord;
            console.log('[CheckIn] Updated existing record at index:', existingIndex);
            return updated;
          } else {
            // Add new record at the beginning
            console.log('[CheckIn] Adding new record to beginning');
            return [normalizedRecord, ...prevData];
          }
        });
        
        // Wait a bit to ensure state update is processed, then fetch fresh data
        setTimeout(async () => {
          try {
            await fetchAttendanceData();
          } catch (err) {
            console.error('Error refreshing attendance data:', err);
          }
        }, 300);
      } else {
        console.warn('[CheckIn] Response missing gio_vao, fetching data immediately');
        // If response doesn't have gio_vao, fetch data immediately
        await fetchAttendanceData();
      }
      
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể check-in. Vui lòng thử lại.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async (qrCodeId = null) => {
    try {
      setCheckOutLoading(true);
      setError('');

      // Ensure we're using today's date
      const currentDate = getLocalDateString();
      if (currentDate !== today) {
        setError('Chỉ có thể check-out cho ngày hôm nay. Vui lòng làm mới trang để cập nhật trạng thái.');
        await fetchAttendanceData();
        return;
      }

      if (checkoutLockEnabled && !canCheckOut) {
        setError(`Check-out chỉ được phép trước ${checkOutLockLabel}. Sau thời gian này chức năng chấm công sẽ bị khóa.`);
        return;
      }

      const { employee_did } = user;
      const checkOutData = {
        employee_did,
        ngay: currentDate, // Always use current date
        gio_ra: new Date().toTimeString().slice(0, 8),
        xac_thuc_qua: qrCodeId ? 'QR Code' : 'Web App'
      };

      if (qrCodeId) {
        checkOutData.qr_code_id = qrCodeId;
      }

      const result = await apiService.checkOut(checkOutData);
      await fetchAttendanceData();
      setError('');

      // Hiển thị thông báo cảnh báo nếu không đủ 5 giờ
      if (result?.warning) {
        const { message, reason, totalHours, requiredHours } = result.warning;
        setPaymentAlert({
          severity: 'warning',
          message: message,
          details: reason,
          totalHours: totalHours,
          requiredHours: requiredHours
        });
      } else if (result?.payment) {
        const { success, usdtAmount, transactionHash, message } = result.payment;
        const severity = success ? 'success' : 'warning';
        const alertMessage = success
          ? `Đã chuyển ${usdtAmount?.toFixed?.(2) || usdtAmount || ''} USDT vào ví của bạn${transactionHash ? ' (TX: ' + transactionHash.slice(0, 10) + '...)' : ''}.`
          : message || 'Thanh toán không đủ điều kiện.';
        setPaymentAlert({
          severity,
          message: alertMessage,
          transactionHash
        });
      } else {
        setPaymentAlert({
          severity: 'info',
          message: 'Check-out thành công nhưng không nhận được thông tin thanh toán tự động. Vui lòng kiểm tra lại lịch sử hoặc liên hệ quản trị.'
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể check-out. Vui lòng thử lại.');
      setPaymentAlert(null);
    } finally {
      setCheckOutLoading(false);
    }
  };

  const handleManualPayment = async (record) => {
    try {
      if (!record?._id) {
        setPaymentAlert({
          severity: 'warning',
          message: 'Không tìm thấy ID bản ghi chấm công để thanh toán.'
        });
        return;
      }

      setPaymentProcessingId(record._id);
      const response = await apiService.payAttendanceRecord(record._id);
      await fetchAttendanceData();

      const payment = response?.payment;
      if (payment) {
        setPaymentAlert({
          severity: payment.success ? 'success' : 'warning',
          message: payment.success
            ? `Đã chuyển ${payment.usdtAmount?.toFixed?.(2) || payment.usdtAmount || ''} USDT vào ví của bạn.`
            : payment.message || 'Thanh toán không thành công.',
          transactionHash: payment.transactionHash
        });
      } else {
        setPaymentAlert({
          severity: 'info',
          message: response?.message || 'Đã gửi yêu cầu thanh toán. Vui lòng kiểm tra lại sau.'
        });
      }
    } catch (err) {
      setPaymentAlert({
        severity: 'error',
        message: err.response?.data?.message || err.message || 'Không thể thực hiện thanh toán.'
      });
    } finally {
      setPaymentProcessingId(null);
    }
  };

  const handleQrCheckIn = () => {
    setQrAction('checkin');
    setQrDialogOpen(true);
  };

  const handleQrCheckOut = () => {
    setQrAction('checkout');
    setQrDialogOpen(true);
  };

  const handleOpenMissedCheckoutDialog = () => {
    setMissedCheckoutDialogOpen(true);
  };

  const handleMissedCheckoutFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    setMissedCheckoutFiles(files);
  };

  const handleSubmitMissedCheckout = async () => {
    try {
      if (!todayRecord || !todayRecord.gio_vao || todayRecord.gio_ra) {
        setError('Chỉ có thể báo quên check-out cho ngày hiện tại khi đã check-in nhưng chưa check-out.');
        setMissedCheckoutDialogOpen(false);
        return;
      }

      const hoursValue = missedCheckoutHours ? Number(missedCheckoutHours) : undefined;
      if (missedCheckoutHours && (isNaN(hoursValue) || hoursValue < 0)) {
        setError('Số giờ ước tính không hợp lệ.');
        return;
      }

      // Chuẩn bị danh sách bằng chứng: link + file upload
      const evidenceLinks = [];

      if (missedCheckoutEvidence) {
        evidenceLinks.push(missedCheckoutEvidence);
      }

      // Nếu người dùng chọn file/ảnh, upload trước rồi lấy file_uri làm bằng chứng
      if (missedCheckoutFiles.length > 0) {
        const formData = new FormData();
        missedCheckoutFiles.forEach((file) => {
          formData.append('files', file);
        });

        const uploadResult = await apiService.uploadMultipleFiles(formData);
        const uploadedFiles = uploadResult?.files || [];
        uploadedFiles.forEach((f) => {
          if (f.file_uri) {
            evidenceLinks.push(f.file_uri);
          }
        });
      }

      const payload = {
        employee_did: user.employee_did,
        ngay: today,
        mo_ta: missedCheckoutDescription,
        gio_xac_nhan: hoursValue,
        bang_chung: evidenceLinks
      };

      await apiService.reportMissedCheckout(payload);
      await fetchAttendanceData();

      setMissedCheckoutDialogOpen(false);
      setMissedCheckoutDescription('');
      setMissedCheckoutHours('');
      setMissedCheckoutEvidence('');
      setMissedCheckoutFiles([]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Không thể gửi báo cáo quên check-out. Vui lòng thử lại.'
      );
    }
  };

  const handleQrScan = async (qrText) => {
    try {
      setQrDialogOpen(false);
      let qrData;
      try {
        qrData = JSON.parse(qrText);
      } catch (parseErr) {
        qrData = { qr_code_id: qrText };
      }

      if (qrAction === 'checkin') {
        await handleCheckIn(qrData.qr_code_id);
      } else if (qrAction === 'checkout') {
        await handleCheckOut(qrData.qr_code_id);
      }
    } catch (err) {
      setError('Không thể xử lý mã QR. Vui lòng thử lại.');
    }
  };

  const handleAdvancedSearch = () => {
    const params = {};
    if (startDate && endDate) {
      params.startDate = startDate.toISOString().split('T')[0];
      params.endDate = endDate.toISOString().split('T')[0];
    }
    if (dayTypeFilter !== 'all') {
      params.loai_ngay = dayTypeFilter;
    }
    fetchAttendanceData(params);
  };

  const handleResetFilters = () => {
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
    setDayTypeFilter('all');
    setSearchTerm('');
    setFilterDate(null);
    fetchAttendanceData();
  };

  const handleViewDetails = async (record) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);

    if (record.transaction_hash) {
      try {
        const logs = await apiService.getSmartContractLogsForAttendance(record._id);
        setRecordDetails(logs);
      } catch (err) {
        setRecordDetails(null);
      }
    } else {
      setRecordDetails(null);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(record => ({
      'Ngày': new Date(record.ngay).toLocaleDateString('vi-VN'),
      'Loại ngày': record.loai_ngay,
      'Giờ vào': record.gio_vao ? formatTime(record.gio_vao) : '--:--',
      'Giờ ra': record.gio_ra ? formatTime(record.gio_ra) : '--:--',
      'Tổng giờ': record.tong_gio_lam ? `${record.tong_gio_lam.toFixed(2)}h` : '--',
      'Lương (USDT)': record.luong_tinh_theo_gio ? record.luong_tinh_theo_gio.toFixed(2) : '--',
      'Phương thức xác thực': record.xac_thuc_qua,
      'Trạng thái on-chain': record.transaction_hash ? 'On-chain' : 'Off-chain',
      'Transaction Hash': record.transaction_hash || '--',
      'Ghi chú': record.ghi_chu || '--'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LichSuChamCong');
    XLSX.writeFile(wb, `lich_su_cham_cong_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getOnChainStatus = (record) => {
    if (record.transaction_hash || record.salary_transaction_hash) {
      return {
        label: 'On-chain',
        color: 'success',
        icon: <VerifiedIcon fontSize="small" />
      };
    } else {
      return {
        label: 'Off-chain',
        color: 'warning',
        icon: <WarningIcon fontSize="small" />
      };
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ngày thường':
        return 'primary';
      case 'Cuối tuần':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    return timeString.slice(0, 5);
  };

  // Giới hạn số giờ hiển thị / tính lương tối đa trong một ngày (ví dụ: 11.5h)
  const MAX_PAID_HOURS = Number(process.env.REACT_APP_MAX_PAID_HOURS || 11.5);

  const calculateWorkingHours = (gio_vao, gio_ra) => {
    if (!gio_vao || !gio_ra) return 0;
    const start = new Date(`2000-01-01T${gio_vao}`);
    const end = new Date(`2000-01-01T${gio_ra}`);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    const positiveHours = diffHours > 0 ? parseFloat(diffHours.toFixed(2)) : 0;
    return Math.min(positiveHours, MAX_PAID_HOURS);
  };

  const filteredData = attendanceData.filter(item => {
    const matchesSearch = !searchTerm ||
      item.ngay.includes(searchTerm) ||
      item.loai_ngay.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate ||
      item.ngay === filterDate.toISOString().split('T')[0];
    return matchesSearch && matchesDate;
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    const completedRecords = filteredData.filter(r => r.gio_vao && r.gio_ra);
    const totalHours = completedRecords.reduce((sum, r) => sum + (r.tong_gio_lam || 0), 0);
    const totalSalary = completedRecords.reduce((sum, r) => sum + (r.luong_tinh_theo_gio || 0), 0);
    const workingDays = completedRecords.length;
    const avgHours = workingDays > 0 ? (totalHours / workingDays).toFixed(2) : 0;

    return {
      totalHours: totalHours.toFixed(2),
      totalSalary: totalSalary.toFixed(2),
      workingDays,
      avgHours
    };
  }, [filteredData]);

  // Get today's date in YYYY-MM-DD format (using local timezone)
  // Use useMemo to calculate today's date once per day
  const today = useMemo(() => getLocalDateString(), []); // Calculate once per mount
  
  // Time constraints - create now once and reuse
  const now = new Date();
  
  // Find today's record - only match records for today
  // Normalize both dates to YYYY-MM-DD format for accurate comparison
  // Use useMemo to ensure it updates when attendanceData changes
  const todayRecord = useMemo(() => {
    const todayStr = getLocalDateString();
    
    return attendanceData.find(item => {
      if (!item.ngay) return false;
      
      // Handle both string and Date object formats
      let recordDateStr;
      if (typeof item.ngay === 'string') {
        // If it's already in YYYY-MM-DD format, use it directly
        if (item.ngay.match(/^\d{4}-\d{2}-\d{2}$/)) {
          recordDateStr = item.ngay;
        } else {
          // Parse the date string
          recordDateStr = getLocalDateString(item.ngay);
        }
      } else {
        // If it's a Date object
        recordDateStr = getLocalDateString(item.ngay);
      }
      
      return recordDateStr === todayStr;
    });
  }, [attendanceData]);
  
  // Debug: Log when todayRecord changes
  useEffect(() => {
    console.log('[AttendanceHistory] todayRecord updated:', todayRecord);
    if (todayRecord) {
      console.log('[AttendanceHistory] todayRecord.gio_vao:', todayRecord.gio_vao);
      console.log('[AttendanceHistory] todayRecord.gio_ra:', todayRecord.gio_ra);
    }
  }, [todayRecord]);
  
  // Auto-refresh data when date changes (check every 5 minutes instead of every minute)
  // Giảm tần suất kiểm tra để tránh làm mới trang liên tục
  useEffect(() => {
    let lastCheckedDate = today;
    
    const checkDateChange = setInterval(() => {
      const currentDate = getLocalDateString();
      if (currentDate !== lastCheckedDate) {
        // Date has changed, refresh data
        lastCheckedDate = currentDate;
        fetchAttendanceData();
      }
    }, 300000); // Check every 5 minutes instead of every minute
    
    return () => clearInterval(checkDateChange);
  }, [today]);

  // Time constraints - use the now variable declared above
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  const checkInStartTime = CHECKIN_START_MINUTES;
  const checkInEndTime = CHECKIN_END_MINUTES;
  const overtimeStartTime = OVERTIME_START_MINUTES;
  const checkOutLockTime = CHECKOUT_LOCK_MINUTES;

  const canCheckIn = !checkinLockEnabled || (currentTime >= checkInStartTime && currentTime <= checkInEndTime);
  const canCheckOut = !checkoutLockEnabled || currentTime < checkOutLockTime;
  const isOvertime = checkoutLockEnabled && currentTime >= overtimeStartTime && currentTime < checkOutLockTime;
  const isLocked = checkoutLockEnabled && currentTime >= checkOutLockTime;
  const shouldShowLateWarning = checkinLockEnabled && !todayRecord?.gio_vao && currentTime > checkInEndTime;
  const checkInStartLabel = formatMinutesToLabel(checkInStartTime);
  const checkInEndLabel = formatMinutesToLabel(checkInEndTime);
  const checkOutLockLabel = formatMinutesToLabel(checkOutLockTime);
  const overtimeStartLabel = formatMinutesToLabel(overtimeStartTime);

  // Calculate today's working hours if checked in
  const todayWorkingHours = todayRecord?.gio_vao && todayRecord?.gio_ra
    ? (typeof todayRecord.tong_gio_lam === 'number'
        ? Math.min(todayRecord.tong_gio_lam, MAX_PAID_HOURS)
        : calculateWorkingHours(todayRecord.gio_vao, todayRecord.gio_ra))
    : todayRecord?.gio_vao
    ? (() => {
        // Khi chưa check-out, chỉ tính đến min(now, 17:30) để dừng tại 5h30 chiều
        const nowStr = new Date().toTimeString().slice(0, 8);
        const [h, m] = nowStr.split(':').map(Number);
        const nowMinutes = h * 60 + m;
        const effectiveMinutes = Math.min(nowMinutes, CHECKOUT_LOCK_MINUTES);
        const effectiveHours = String(Math.floor(effectiveMinutes / 60)).padStart(2, '0');
        const effectiveMins = String(effectiveMinutes % 60).padStart(2, '0');
        const effectiveTimeStr = `${effectiveHours}:${effectiveMins}:00`;
        return calculateWorkingHours(todayRecord.gio_vao, effectiveTimeStr);
      })()
    : 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography 
            variant="h5" 
            fontWeight="bold" 
            sx={{ 
              mb: 0.5,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Lịch sử chấm công
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Quản lý và theo dõi lịch sử chấm công của bạn
          </Typography>
        </Box>

        {/* Salary & attendance rules info */}
        <Card
          variant="outlined"
          sx={{
            mb: 2,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(33,150,243,0.08) 0%, rgba(0,230,118,0.06) 100%)'
              : 'linear-gradient(135deg, #e3f2fd 0%, #e8f5e9 100%)',
            borderColor: theme.palette.mode === 'dark'
              ? 'rgba(144,202,249,0.3)'
              : 'rgba(25,118,210,0.3)'
          }}
        >
          <CardContent sx={{ py: 1.5 }}>
            <Box display="flex" alignItems="flex-start" gap={1.5}>
              <InfoIcon color="primary" sx={{ mt: 0.4 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Quy tắc chấm công & tính lương trong ngày
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  - Check-in: từ <strong>{formatMinutesToLabel(CHECKIN_START_MINUTES)}</strong> đến{' '}
                  <strong>{formatMinutesToLabel(CHECKIN_END_MINUTES)}</strong>. Sau{' '}
                  <strong>{formatMinutesToLabel(CHECKOUT_LOCK_MINUTES)}</strong> hệ thống khóa chấm công trong ngày.
                  <br />
                  - Lương ngày = <strong>số giờ làm hợp lệ × 2 USDT/giờ</strong>, chỉ tính khi bạn làm tối thiểu{' '}
                  <strong>5 giờ</strong> trong ngày.
                  <br />
                  - Nếu quên check-out: bấm <strong>“Báo quên check-out / Gửi biểu mẫu giải trình”</strong>, cung cấp mô tả và
                  bằng chứng. Nếu được admin chấp thuận, lương ngày đó được thanh toán với hệ số{' '}
                  <strong>50%</strong>.
                  <br />
                  - Tiền lương được chuyển tự động vào ví của bạn sau khi hệ thống ghi nhận check-out / phê duyệt giải trình.
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setError('')}
            size="small"
          >
            {error}
          </Alert>
        )}

        {/* Payment Alert */}
        {paymentAlert && (
          <Alert
            severity={paymentAlert.severity}
            sx={{ mb: 2 }}
            onClose={() => setPaymentAlert(null)}
            icon={paymentAlert.severity === 'warning' ? <WarningIcon /> : <WalletIcon />}
            size="small"
            action={
              paymentAlert.transactionHash ? (
                <Button
                  color="inherit"
                  size="small"
                  href={`https://sepolia.etherscan.io/tx/${paymentAlert.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Xem TX
                </Button>
              ) : null
            }
          >
            <Box>
              <Typography variant="body2" fontWeight="bold">
                {paymentAlert.message}
              </Typography>
              {paymentAlert.details && (
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                  {paymentAlert.details}
                </Typography>
              )}
              {paymentAlert.totalHours !== undefined && paymentAlert.requiredHours !== undefined && (
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                  Số giờ làm việc: <strong>{paymentAlert.totalHours}h</strong> / Yêu cầu tối thiểu: <strong>{paymentAlert.requiredHours}h</strong>
                </Typography>
              )}
            </Box>
          </Alert>
        )}

        {/* Status Alerts */}
        {shouldShowLateWarning && checkinLockEnabled && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<LockClockIcon />} size="small">
            Đã quá thời gian check-in ({checkInEndLabel}). Vui lòng liên hệ quản lý để được hỗ trợ.
          </Alert>
        )}

        {isLocked && (
          <Alert severity="error" sx={{ mb: 2 }} icon={<LockClockIcon />} size="small">
            Chức năng chấm công đã bị khóa sau {checkOutLockLabel}. Vui lòng chấm công vào ngày hôm sau.
          </Alert>
        )}

        {isOvertime && todayRecord?.gio_vao && !todayRecord?.gio_ra && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<TrendingUpIcon />} size="small">
            Bạn đang trong giờ tăng ca (sau {overtimeStartLabel}). Vui lòng check-out trước {checkOutLockLabel} để hoàn tất chấm công.
          </Alert>
        )}

        {todayRecord && todayRecord.gio_vao && !todayRecord.gio_ra && 
         todayRecord.quen_checkout_trang_thai === 'Đã phê duyệt' && (
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />} size="small">
            Giải trình quên check-out của bạn đã được <strong>admin phê duyệt</strong>. 
            Lương sẽ được tính và thanh toán tự động vào ví của bạn.
          </Alert>
        )}

        {todayRecord && todayRecord.gio_vao && !todayRecord.gio_ra && 
         todayRecord.quen_checkout_trang_thai === 'Chờ phê duyệt' && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<InfoIcon />} size="small">
            Giải trình quên check-out của bạn đang <strong>chờ admin phê duyệt</strong>. 
            Vui lòng đợi admin xem xét và phê duyệt.
          </Alert>
        )}

        {todayRecord && todayRecord.gio_vao && !todayRecord.gio_ra && 
         todayRecord.quen_checkout_trang_thai !== 'Đã phê duyệt' &&
         todayRecord.quen_checkout_trang_thai !== 'Chờ phê duyệt' && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />} size="small">
            Bạn đã check-in nhưng chưa check-out. Trạng thái hiện tại: <strong>Tạm ngưng</strong>. 
            Vui lòng check-out trước {checkOutLockLabel} để hoàn tất chấm công. Nếu lỡ quên check-out,
            hãy gửi biểu mẫu giải trình để admin xem xét.
          </Alert>
        )}

        {/* Quick Action Buttons */}
        <Card 
          sx={{ 
            mb: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  startIcon={checkInLoading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
                  onClick={() => handleCheckIn()}
                  disabled={
                    checkInLoading ||
                    loading ||
                    !!(todayRecord && todayRecord.gio_vao) ||
                    !canCheckIn
                  }
                  sx={{
                    py: 1.2,
                    background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`,
                    },
                    boxShadow: 2,
                  }}
                >
                  {checkInLoading ? 'Đang xử lý...' : 'Check-in'}
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  startIcon={checkOutLoading ? <CircularProgress size={18} color="inherit" /> : <LogoutIcon />}
                  onClick={() => handleCheckOut()}
                  disabled={
                    checkOutLoading ||
                    loading ||
                    !todayRecord?.gio_vao ||
                    !!todayRecord?.gio_ra ||
                    (checkoutLockEnabled && !canCheckOut)
                  }
                  sx={{
                    py: 1.2,
                    background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
                    },
                    boxShadow: 2,
                  }}
                >
                  {checkOutLoading ? 'Đang xử lý...' : 'Check-out'}
                </Button>
              </Grid>
              {todayRecord?.gio_vao && !todayRecord?.gio_ra && 
               todayRecord.quen_checkout_trang_thai !== 'Đã phê duyệt' && (
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<WarningIcon />}
                    onClick={handleOpenMissedCheckoutDialog}
                    sx={{ mt: { xs: 1, sm: 0 } }}
                  >
                    Báo quên check-out / Gửi biểu mẫu giải trình
                  </Button>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'white',
                boxShadow: 2,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>
                      Tổng giờ làm
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {statistics.totalHours}h
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
                    <WorkIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                color: 'white',
                boxShadow: 2,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>
                      Tổng lương
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {statistics.totalSalary} USDT
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
                    <MoneyIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                color: 'white',
                boxShadow: 2,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>
                      Số ngày làm việc
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {statistics.workingDays}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
                    <CalendarIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                color: 'white',
                boxShadow: 2,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>
                      Giờ TB/ngày
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {statistics.avgHours}h
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
                    <TrendingUpIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Today's Status Card */}
        <Card 
          sx={{ 
            mb: 2,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.main}08 100%)`,
            border: `1px solid ${theme.palette.primary.main}20`,
            boxShadow: 2,
          }}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="subtitle1" fontWeight="bold">
              Trạng thái hôm nay ({new Date().toLocaleDateString('vi-VN')})
            </Typography>
              {todayRecord?.gio_vao && !todayRecord?.gio_ra && (
                <Chip 
                  label="Đang làm việc" 
                  color="warning" 
                  icon={<AccessTimeIcon />}
                  size="small"
                />
              )}
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={6} sm={3}>
                <Box 
                  textAlign="center" 
                  p={1.5} 
                  sx={{
                    borderRadius: 1.5,
                    bgcolor: todayRecord?.gio_vao ? 'success.main' : 'grey.200',
                    color: todayRecord?.gio_vao ? 'white' : 'text.secondary',
                    transition: 'all 0.3s',
                  }}
                >
                  <LoginIcon sx={{ fontSize: 28, mb: 0.5 }} />
                  <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                    Check-in
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {todayRecord?.gio_vao ? formatTime(todayRecord.gio_vao) : '--:--'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box 
                  textAlign="center" 
                  p={1.5} 
                  sx={{
                    borderRadius: 1.5,
                    bgcolor: todayRecord?.gio_ra ? 'error.main' : 'grey.200',
                    color: todayRecord?.gio_ra ? 'white' : 'text.secondary',
                    transition: 'all 0.3s',
                  }}
                >
                  <LogoutIcon sx={{ fontSize: 28, mb: 0.5 }} />
                  <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                    Check-out
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {todayRecord?.gio_ra ? formatTime(todayRecord.gio_ra) : '--:--'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box 
                  textAlign="center" 
                  p={1.5} 
                  sx={{
                    borderRadius: 1.5,
                    bgcolor: 'primary.main',
                    color: 'white',
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 28, mb: 0.5 }} />
                  <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                    Giờ làm việc
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {todayWorkingHours.toFixed(2)}h
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box 
                  textAlign="center" 
                  p={1.5} 
                  sx={{
                    borderRadius: 1.5,
                    bgcolor: 'secondary.main',
                    color: 'white',
                  }}
                >
                  <WalletIcon sx={{ fontSize: 28, mb: 0.5 }} />
                  <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                    Lương hôm nay
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {(todayWorkingHours * 2).toFixed(2)} USDT
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Advanced Filters */}
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Accordion defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 1 } }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <FilterIcon fontSize="small" />
                  <Typography variant="subtitle2" fontWeight="bold">
                  Bộ lọc nâng cao
                </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="Từ ngày"
                      value={startDate}
                      onChange={setStartDate}
                      renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="Đến ngày"
                      value={endDate}
                      onChange={setEndDate}
                      renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Loại ngày</InputLabel>
                      <Select
                        value={dayTypeFilter}
                        onChange={(e) => setDayTypeFilter(e.target.value)}
                        label="Loại ngày"
                      >
                        <MenuItem value="all">Tất cả</MenuItem>
                        <MenuItem value="Ngày thường">Ngày thường</MenuItem>
                        <MenuItem value="Cuối tuần">Cuối tuần</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                      <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={handleAdvancedSearch}
                        size="small"
                      >
                        Áp dụng
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleResetFilters}
                        size="small"
                      >
                        Đặt lại
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<ExportIcon />}
                        onClick={handleExportExcel}
                        color="secondary"
                        size="small"
                      >
                        Xuất Excel
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card sx={{ boxShadow: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="subtitle1" fontWeight="bold">
                Lịch sử chấm công
            </Typography>
              <Chip 
                label={`${filteredData.length} bản ghi`} 
                color="primary" 
                variant="outlined"
                size="small"
              />
            </Box>

            {loading ? (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="200px">
                <CircularProgress size={40} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
                  Đang tải dữ liệu...
                </Typography>
              </Box>
            ) : (
              <TableContainer 
                component={Paper} 
                elevation={0}
                sx={{ 
                  borderRadius: 1.5,
                  border: `1px solid ${theme.palette.divider}`,
                  maxHeight: '500px',
                  overflow: 'auto'
                }}
              >
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Ngày</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Loại ngày</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Giờ vào</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Giờ ra</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Tổng giờ</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Lương (USDT)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Trạng thái</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>On-chain</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', py: 1 }}>Hành động</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <InfoIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Không có dữ liệu chấm công
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((record) => {
                        const onChainStatus = getOnChainStatus(record);
                        let statusText = 'Chưa check-in';
                        let statusColor = 'default';

                        // Nghỉ phép (mọi loại nghỉ) => trạng thái = Nghỉ phép
                        const isLeaveDay =
                          record.loai_nghi_phep ||
                          record.loai_ngay === 'Nghỉ phép' ||
                          record.loai_ngay === 'Nghỉ việc riêng' ||
                          record.loai_ngay === 'Nghỉ ốm' ||
                          record.loai_ngay === 'Nghỉ thai sản' ||
                          record.loai_ngay === 'Nghỉ không lương';

                        if (isLeaveDay) {
                          statusText = 'Nghỉ phép';
                          statusColor = 'warning';
                        } else if (record.trang_thai_cham_cong) {
                          statusText = record.trang_thai_cham_cong;
                          statusColor =
                            record.trang_thai_cham_cong === 'Đã hoàn thành'
                              ? 'success'
                              : record.trang_thai_cham_cong === 'Tạm ngưng'
                                ? 'warning'
                                : 'default';
                        } else if (record.gio_vao && !record.gio_ra) {
                          statusText = 'Tạm ngưng';
                          statusColor = 'warning';
                        } else if (record.gio_vao && record.gio_ra) {
                          statusText = 'Đã hoàn thành';
                          statusColor = 'success';
                        }
                        
                        const canManualPay = !!record._id &&
                          record.tong_gio_lam > 0 &&
                          (record.trang_thai_cham_cong === 'Đã hoàn thành') &&
                          !record.salary_transaction_hash;
                        
                        return (
                          <TableRow 
                            key={record._id || record.ngay} 
                            hover
                            sx={{ 
                              '&:hover': { 
                                bgcolor: 'action.hover',
                                cursor: 'pointer'
                              }
                            }}
                            onClick={() => handleViewDetails(record)}
                          >
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                              {new Date(record.ngay).toLocaleDateString('vi-VN')}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={record.loai_ngay === 'Cuối tuần' ? 'Cuối tuần' : 'Ngày thường'}
                                color={getStatusColor(
                                  record.loai_ngay === 'Cuối tuần' ? 'Cuối tuần' : 'Ngày thường'
                                )}
                                size="small"
                                sx={{ fontWeight: 'medium' }}
                              />
                            </TableCell>
                            <TableCell>
                              {record.gio_vao ? (
                                <Box display="flex" alignItems="center" gap={1}>
                                  <CheckCircleIcon color="success" fontSize="small" />
                                  <Typography variant="body2" fontWeight="medium">
                                  {formatTime(record.gio_vao)}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">--:--</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.gio_ra ? (
                                <Box display="flex" alignItems="center" gap={1}>
                                  <ErrorIcon color="error" fontSize="small" />
                                  <Typography variant="body2" fontWeight="medium">
                                  {formatTime(record.gio_ra)}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">--:--</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                {record.tong_gio_lam ? `${record.tong_gio_lam.toFixed(2)}h` : '--'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box>
                                {(() => {
                                  // Tính lương: nếu có quen_checkout_trang_thai = 'Đã phê duyệt' thì hệ số 50%, ngược lại 100%
                                  let calculatedSalary = null;
                                  if (record.luong_tinh_theo_gio !== null && record.luong_tinh_theo_gio !== undefined) {
                                    calculatedSalary = record.luong_tinh_theo_gio;
                                  } else if (record.tong_gio_lam) {
                                    // Tính lương tạm thời nếu chưa có trong database
                                    const hourlyRate = 2; // 2 USDT/h
                                    const multiplier = record.quen_checkout_trang_thai === 'Đã phê duyệt' ? 0.5 : 1;
                                    calculatedSalary = record.tong_gio_lam * hourlyRate * multiplier;
                                  }
                                  
                                  return (
                                    <>
                                      <Typography variant="body2" fontWeight="bold" color="success.main">
                                        {calculatedSalary !== null ? `${calculatedSalary.toFixed(2)} USDT` : '--'}
                                      </Typography>
                                      {record.tong_gio_lam && (
                                        <Typography variant="caption" color="text.secondary">
                                          {record.tong_gio_lam.toFixed(2)}h × 2 USDT/h
                                          {record.quen_checkout_trang_thai === 'Đã phê duyệt' && ' × 50%'}
                                        </Typography>
                                      )}
                                    </>
                                  );
                                })()}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={statusText}
                                color={statusColor}
                                size="small"
                                icon={statusColor === 'warning' ? <WarningIcon /> : statusColor === 'success' ? <CheckCircleIcon /> : <InfoIcon />}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={onChainStatus.label}
                                color={onChainStatus.color}
                                size="small"
                                icon={onChainStatus.icon}
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Box display="flex" gap={1}>
                                <Tooltip title={canManualPay ? 'Nhận lương chấm công' : (record.salary_transaction_hash ? 'Đã thanh toán' : 'Chưa đủ điều kiện')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      disabled={!canManualPay || paymentProcessingId === record._id}
                                      onClick={() => handleManualPayment(record)}
                                    >
                                      {paymentProcessingId === record._id ? (
                                        <CircularProgress size={16} color="inherit" />
                                      ) : (
                                        <WalletIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Xem chi tiết">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewDetails(record)}
                                    color="primary"
                                  >
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                {(record.transaction_hash || record.salary_transaction_hash) && (
                                  <Tooltip title="Xem trên blockchain">
                                    <IconButton
                                      size="small"
                                      component={Link}
                                      href="https://sepolia.etherscan.io/address/0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E#tokentxns"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      color="secondary"
                                    >
                                      <LinkIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* QR Scanner Dialog */}
        <Dialog
          open={qrDialogOpen}
          onClose={() => setQrDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Quét mã QR để {qrAction === 'checkin' ? 'Check-in' : 'Check-out'}
          </DialogTitle>
          <DialogContent>
            <QrScanner onScan={handleQrScan} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQrDialogOpen(false)}>Hủy</Button>
          </DialogActions>
        </Dialog>

        {/* Detail Modal */}
        <Dialog
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <InfoIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
            Chi tiết bản ghi chấm công
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedRecord && (
              <Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Ngày</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {new Date(selectedRecord.ngay).toLocaleDateString('vi-VN')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Loại ngày</Typography>
                    <Chip
                      label={selectedRecord.loai_ngay}
                      color={getStatusColor(selectedRecord.loai_ngay)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Giờ vào</Typography>
                    <Typography variant="body1">
                      {selectedRecord.gio_vao ? formatTime(selectedRecord.gio_vao) : '--:--'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Giờ ra</Typography>
                    <Typography variant="body1">
                      {selectedRecord.gio_ra ? formatTime(selectedRecord.gio_ra) : '--:--'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Tổng giờ làm</Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary">
                      {selectedRecord.tong_gio_lam ? `${selectedRecord.tong_gio_lam.toFixed(2)}h` : '--'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Lương (USDT)</Typography>
                    <Typography variant="body1" fontWeight="bold" color="success.main">
                      {selectedRecord.luong_tinh_theo_gio ? `${selectedRecord.luong_tinh_theo_gio.toFixed(2)} USDT` : '--'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Trạng thái on-chain</Typography>
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      <Chip
                        label={(selectedRecord.transaction_hash || selectedRecord.salary_transaction_hash) ? 'On-chain' : 'Off-chain'}
                        color={(selectedRecord.transaction_hash || selectedRecord.salary_transaction_hash) ? 'success' : 'warning'}
                        size="small"
                        icon={(selectedRecord.transaction_hash || selectedRecord.salary_transaction_hash) ? <VerifiedIcon fontSize="small" /> : <WarningIcon fontSize="small" />}
                      />
                      {(selectedRecord.transaction_hash || selectedRecord.salary_transaction_hash) && (
                        <Link
                          href="https://sepolia.etherscan.io/address/0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E#tokentxns"
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                          <LinkIcon fontSize="small" />
                          Xem trên blockchain
                        </Link>
                      )}
                    </Box>
                  </Grid>
                  {(selectedRecord.transaction_hash || selectedRecord.salary_transaction_hash) && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Transaction Hash</Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        {selectedRecord.salary_transaction_hash || selectedRecord.transaction_hash}
                      </Typography>
                    </Grid>
                  )}
                    </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailModalOpen(false)} variant="contained">Đóng</Button>
          </DialogActions>
        </Dialog>

        {/* Missed Checkout Dialog */}
        <Dialog
          open={missedCheckoutDialogOpen}
          onClose={() => setMissedCheckoutDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <WarningIcon color="warning" />
              <Typography variant="h6" fontWeight="bold">
                Biểu mẫu giải trình quên check-out
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info" size="small">
                Vui lòng mô tả chi tiết bạn đã làm gì trong ngày và cung cấp bằng chứng (link ảnh, file, ghi chú...)
                để admin xem xét. Nếu được chấp thuận, lương ngày này sẽ được tính và thanh toán với hệ số 50%.
              </Alert>
              <TextField
                label="Bạn đã làm gì trong ngày?"
                multiline
                minRows={3}
                fullWidth
                value={missedCheckoutDescription}
                onChange={(e) => setMissedCheckoutDescription(e.target.value)}
              />
              <TextField
                label="Số giờ ước tính đã làm (giờ)"
                type="number"
                fullWidth
                value={missedCheckoutHours}
                onChange={(e) => setMissedCheckoutHours(e.target.value)}
                helperText="Tuỳ chọn - nếu bỏ trống, admin có thể tự xác nhận sau"
                inputProps={{ min: 0, step: 0.5 }}
              />
              <TextField
                label="Link bằng chứng (Google Drive, ảnh, tài liệu...)"
                fullWidth
                value={missedCheckoutEvidence}
                onChange={(e) => setMissedCheckoutEvidence(e.target.value)}
                helperText="Tuỳ chọn - dán 1 link chứa ảnh/file làm bằng chứng"
              />
              <Box>
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  startIcon={<UploadIcon />}
                  sx={{ mb: 1 }}
                >
                  Chọn file / chụp ảnh
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={handleMissedCheckoutFilesChange}
                  />
                </Button>
                {missedCheckoutFiles.length > 0 && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Đã chọn {missedCheckoutFiles.length} file:{" "}
                    {missedCheckoutFiles.map((f) => f.name).join(", ")}
                  </Typography>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMissedCheckoutDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="contained" onClick={handleSubmitMissedCheckout}>
              Gửi giải trình
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating Action Button */}
        {!isMobile && !todayRecord?.gio_vao && canCheckIn && (
          <Tooltip title="Check-in nhanh" arrow>
            <Fab
              color="success"
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 1000,
                boxShadow: 6,
              }}
              onClick={handleCheckIn}
              disabled={checkInLoading}
            >
              {checkInLoading ? <CircularProgress size={24} color="inherit" /> : <CheckCircleIcon />}
            </Fab>
          </Tooltip>
        )}
      </Box>
    </LocalizationProvider>
  );
}

export default AttendanceHistory;
