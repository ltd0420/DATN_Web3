import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, Avatar, Alert, Snackbar, FormControl,
  InputLabel, Select, MenuItem, IconButton, Tooltip, Paper,
  CircularProgress, InputAdornment, Tabs, Tab, Badge, Divider,
  LinearProgress, Skeleton, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Link
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as MoneyIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  PauseCircle as PauseIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  CalendarMonth as CalendarIcon,
  CalendarViewMonth as YearIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi } from 'date-fns/locale';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, subDays, subWeeks, subMonths
} from 'date-fns';
import apiService from '../../services/apiService';

const AttendanceManagement = ({ user }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('month'); // day, week, month, year
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [selectedEmployeeDid, setSelectedEmployeeDid] = useState(null);
  const [attendanceTxHashes, setAttendanceTxHashes] = useState({}); // Map record_id -> valid tx_hash
  const [missedDialogOpen, setMissedDialogOpen] = useState(false);
  const [selectedMissedRecord, setSelectedMissedRecord] = useState(null);
  const [missedAdminReason, setMissedAdminReason] = useState('');
  const [missedAdminHours, setMissedAdminHours] = useState('');
  const [missedAdminLoading, setMissedAdminLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Statistics
  const [stats, setStats] = useState({
    totalRecords: 0,
    completedRecords: 0,
    pendingRecords: 0,
    totalHours: 0,
    totalSalary: 0
  });

  // Get date range based on filter period
  const getDateRange = useCallback(() => {
    const now = new Date();
    let start, end;
    
    switch (filterPeriod) {
      case 'day':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = startOfDay(customStartDate);
          end = endOfDay(customEndDate);
        } else {
          start = startOfMonth(now);
          end = endOfMonth(now);
        }
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    // Trả về đúng khoảng thời gian thực tế (không mở rộng thêm), để:
    // - "Hôm nay": chỉ hiển thị đúng ngày hiện tại
    // - "Tuần này": từ thứ 2 đến chủ nhật tuần hiện tại
    // - "Tháng này": từ ngày 1 đến ngày cuối tháng hiện tại
    // - "Năm nay": từ 01/01 đến 31/12 năm hiện tại
    // - "Tùy chọn": đúng khoảng người dùng chọn
    return { start, end };
  }, [filterPeriod, customStartDate, customEndDate]);

  // Calculate statistics
  const calculateStats = useCallback((data) => {
    const totalRecords = data.length;
    const completedRecords = data.filter(r => r.trang_thai_cham_cong === 'Đã hoàn thành').length;
    const pendingRecords = data.filter(r => r.trang_thai_cham_cong === 'Tạm ngưng').length;
    const totalHours = data.reduce((sum, r) => sum + (r.tong_gio_lam || 0), 0);
    const totalSalary = data.reduce((sum, r) => sum + (r.luong_tinh_theo_gio || 0), 0);

    setStats({
      totalRecords,
      completedRecords,
      pendingRecords,
      totalHours: Math.round(totalHours * 100) / 100,
      totalSalary: Math.round(totalSalary * 100) / 100
    });
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[AttendanceManagement] Fetching data...');
      
      const [empRes, deptRes] = await Promise.all([
        apiService.getAllEmployees(),
        apiService.getDepartments()
      ]);

      console.log('[AttendanceManagement] Employees:', empRes?.length || 0);
      console.log('[AttendanceManagement] Departments:', deptRes?.length || 0);

      setEmployees(empRes || []);
      setDepartments(deptRes || []);

      // Fetch attendance for all employees
      const { start, end } = getDateRange();
      console.log('[AttendanceManagement] Date range:', start.toISOString(), 'to', end.toISOString());
      
      let response;
      let data = [];
      
      try {
        // Thử fetch với date range
        response = await apiService.getAllAttendance({
            startDate: start.toISOString(),
            endDate: end.toISOString()
        });
        console.log('[AttendanceManagement] API Response (with date):', response);
      } catch (dateError) {
        console.warn('[AttendanceManagement] Error with date filter, trying without date:', dateError);
        // Nếu lỗi với date filter, thử fetch không có date filter
        try {
          response = await apiService.getAllAttendance({});
          console.log('[AttendanceManagement] API Response (no date):', response);
        } catch (noDateError) {
          console.error('[AttendanceManagement] Error fetching without date:', noDateError);
          throw noDateError;
        }
      }
      
      // Xử lý response - Backend trả về array trực tiếp
      if (Array.isArray(response)) {
        data = response;
      } else if (response && Array.isArray(response.data)) {
        data = response.data;
      } else if (response && response.data) {
        data = Array.isArray(response.data) ? response.data : [];
      } else if (response && typeof response === 'object') {
        // Có thể response là object, thử lấy tất cả values
        const values = Object.values(response);
        if (values.length > 0 && Array.isArray(values[0])) {
          data = values[0];
        }
      }
      
      console.log('[AttendanceManagement] Attendance data:', data.length, 'records');
      if (data.length > 0) {
        console.log('[AttendanceManagement] Sample record:', data[0]);
        
        // Tạo map transaction hash hợp lệ từ records
        const txHashMap = {};
        data.forEach(record => {
          if (record._id) {
            // Ưu tiên salary_transaction_hash, sau đó transaction_hash
            const txHash = record.salary_transaction_hash || record.transaction_hash;
            if (txHash) {
              // Validate transaction hash format (0x + 64 hex = 66 chars)
              const isValidHash = typeof txHash === 'string' &&
                                 txHash.startsWith('0x') && 
                                 txHash.length === 66 && 
                                 /^0x[a-fA-F0-9]{64}$/.test(txHash);
              if (isValidHash) {
                txHashMap[record._id] = txHash;
              } else {
                console.warn(`[AttendanceManagement] Invalid TX hash for record ${record._id}: ${txHash}`);
              }
            }
          }
        });
        setAttendanceTxHashes(txHashMap);
        console.log('[AttendanceManagement] Valid TX hashes found:', Object.keys(txHashMap).length);
      } else {
        console.warn('[AttendanceManagement] No attendance data found. Response:', response);
        // Thử fetch lại không có date filter nếu không có dữ liệu
        if (filterPeriod !== 'custom') {
          try {
            const fallbackResponse = await apiService.getAllAttendance({});
            const fallbackData = Array.isArray(fallbackResponse) ? fallbackResponse : (fallbackResponse?.data || []);
            if (fallbackData.length > 0) {
              console.log('[AttendanceManagement] Found', fallbackData.length, 'records without date filter');
              data = fallbackData;
              
              // Tạo map cho fallback data
              const txHashMap = {};
              fallbackData.forEach(record => {
                if (record._id) {
                  const txHash = record.salary_transaction_hash || record.transaction_hash;
                  if (txHash) {
                    const isValidHash = typeof txHash === 'string' &&
                                       txHash.startsWith('0x') && 
                                       txHash.length === 66 && 
                                       /^0x[a-fA-F0-9]{64}$/.test(txHash);
                    if (isValidHash) {
                      txHashMap[record._id] = txHash;
                    }
                  }
                }
              });
              setAttendanceTxHashes(txHashMap);
            }
          } catch (fallbackError) {
            console.error('[AttendanceManagement] Fallback error:', fallbackError);
          }
        }
      }
      
      setAttendanceData(data);

      // Calculate statistics
      calculateStats(data);
    } catch (error) {
      console.error('[AttendanceManagement] Error fetching data:', error);
      console.error('[AttendanceManagement] Error details:', error.response?.data || error.message);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || error.message || 'Lỗi khi tải dữ liệu chấm công', 
        severity: 'error' 
      });
      setAttendanceData([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, calculateStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get employee info
  const getEmployeeInfo = (employeeDid) => {
    return employees.find(emp => emp.employee_did === employeeDid) || {};
  };

  // Get department name
  const getDepartmentName = (departmentId) => {
    const dept = departments.find(d => d.phong_ban_id === departmentId);
    return dept ? dept.ten_phong_ban : 'Chưa xác định';
  };

  // Filter data
  const filteredData = React.useMemo(() => {
    console.log('[AttendanceManagement] Filtering data. Total records:', attendanceData.length);
    console.log('[AttendanceManagement] Filters:', { filterDepartment, filterEmployee, filterStatus, searchQuery });
    
    const filtered = attendanceData.filter(record => {
      const employee = getEmployeeInfo(record.employee_did);

      // Filter by department
      if (filterDepartment !== 'all' && employee.phong_ban_id !== filterDepartment) {
        return false;
      }

      // Filter by employee
      if (filterEmployee !== 'all' && record.employee_did !== filterEmployee) {
        return false;
      }

      // Filter by status
      if (filterStatus !== 'all' && record.trang_thai_cham_cong !== filterStatus) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchEmployee = employee.ho_ten?.toLowerCase().includes(query) ||
          employee.employee_did?.toLowerCase().includes(query);
        const matchDept = getDepartmentName(employee.phong_ban_id)?.toLowerCase().includes(query);
        if (!matchEmployee && !matchDept) return false;
      }

      return true;
    });
    
    console.log('[AttendanceManagement] Filtered records:', filtered.length);
    return filtered;
  }, [attendanceData, filterDepartment, filterEmployee, filterStatus, searchQuery, employees, departments]);

  const handleViewLogs = async (employeeDid) => {
    try {
      setSelectedEmployeeDid(employeeDid);
      setLogDialogOpen(true);
      setLogLoading(true);
      const logs = await apiService.getAttendanceLogs(employeeDid);
      setLogEntries(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setSnackbar({ open: true, message: 'Lỗi khi tải lịch sử giao dịch', severity: 'error' });
      setLogEntries([]);
    } finally {
      setLogLoading(false);
    }
  };

  // Get status chip (Hoàn thành / Tạm ngưng / Nghỉ phép / Chưa check-in)
  const getStatusChip = (record) => {
    if (!record) {
      return <Chip label="N/A" size="small" />;
    }

    const { trang_thai_cham_cong, loai_nghi_phep, loai_ngay } = record;

    const isLeaveDay =
      loai_nghi_phep ||
      loai_ngay === 'Nghỉ phép' ||
      loai_ngay === 'Nghỉ việc riêng' ||
      loai_ngay === 'Nghỉ ốm' ||
      loai_ngay === 'Nghỉ thai sản' ||
      loai_ngay === 'Nghỉ không lương';

    if (isLeaveDay) {
      return <Chip icon={<WarningIcon />} label="Nghỉ phép" color="warning" size="small" />;
    }

    switch (trang_thai_cham_cong) {
      case 'Đã hoàn thành':
        return <Chip icon={<CheckCircleIcon />} label="Đã hoàn thành" color="success" size="small" />;
      case 'Tạm ngưng':
        return <Chip icon={<PauseIcon />} label="Tạm ngưng" color="warning" size="small" />;
      case 'Chưa check-in':
        return <Chip icon={<ErrorIcon />} label="Chưa check-in" color="error" size="small" />;
      default:
        return <Chip label={trang_thai_cham_cong || 'N/A'} size="small" />;
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Export data
  const handleExport = () => {
    const csvContent = [
      ['Ngày', 'Nhân viên', 'Phòng ban', 'Giờ vào', 'Giờ ra', 'Tổng giờ', 'Lương (USDT)', 'Trạng thái', 'Giao dịch'].join(','),
      ...filteredData.map(record => {
        const employee = getEmployeeInfo(record.employee_did);
        return [
          format(new Date(record.ngay), 'dd/MM/yyyy'),
          employee.ho_ten || record.employee_did,
          getDepartmentName(employee.phong_ban_id),
          record.gio_vao || '-',
          record.gio_ra || '-',
          record.tong_gio_lam || 0,
          record.luong_tinh_theo_gio || 0,
          record.trang_thai_cham_cong || 'N/A',
          record.transaction_hash ? 'Có' : 'Không'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cham_cong_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
  };

  // Missed checkout helpers
  const hasMissedCheckoutReport = (record) =>
    record?.quen_checkout_bao_cao === true ||
    (record?.quen_checkout_trang_thai && record.quen_checkout_trang_thai !== 'Không áp dụng');

  const getMissedStatusChip = (record) => {
    if (!hasMissedCheckoutReport(record)) {
      return null;
    }

    const status = record.quen_checkout_trang_thai || 'Chờ phê duyệt';

    switch (status) {
      case 'Đã phê duyệt':
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="Đã phê duyệt"
            color="success"
            size="small"
          />
        );
      case 'Từ chối':
        return (
          <Chip
            icon={<ErrorIcon />}
            label="Đã từ chối"
            color="error"
            size="small"
          />
        );
      case 'Chờ phê duyệt':
      default:
        return (
          <Chip
            icon={<WarningIcon />}
            label="Chờ phê duyệt"
            color="warning"
            size="small"
          />
        );
    }
  };

  const handleOpenMissedDialog = (record) => {
    setSelectedMissedRecord(record);
    setMissedAdminReason('');
    setMissedAdminHours(record?.quen_checkout_gio_xac_nhan ? String(record.quen_checkout_gio_xac_nhan) : '');
    setMissedDialogOpen(true);
  };

  const handleSubmitMissedDecision = async (action) => {
    if (!selectedMissedRecord || !selectedMissedRecord._id) return;

    try {
      setMissedAdminLoading(true);

      let hoursValue;
      if (missedAdminHours !== '') {
        hoursValue = Number(missedAdminHours);
        if (isNaN(hoursValue) || hoursValue < 0) {
          setSnackbar({
            open: true,
            message: 'Số giờ xác nhận không hợp lệ.',
            severity: 'error'
          });
          setMissedAdminLoading(false);
          return;
        }
      }

      await apiService.approveMissedCheckout(selectedMissedRecord._id, {
        action,
        ly_do_admin: missedAdminReason,
        gio_xac_nhan: hoursValue
      });

      await fetchData();

      setSnackbar({
        open: true,
        message:
          action === 'approve'
            ? 'Đã phê duyệt báo quên check-out (lương tính với hệ số 50% nếu đủ điều kiện).'
            : 'Đã từ chối báo quên check-out và đánh dấu nghỉ phép không lương.',
        severity: action === 'approve' ? 'success' : 'warning'
      });

      setMissedDialogOpen(false);
      setSelectedMissedRecord(null);
      setMissedAdminReason('');
      setMissedAdminHours('');
    } catch (error) {
      console.error('approve missed checkout error:', error);
      setSnackbar({
        open: true,
        message:
          error.response?.data?.message ||
          error.message ||
          'Lỗi khi phê duyệt báo quên check-out.',
        severity: 'error'
      });
    } finally {
      setMissedAdminLoading(false);
    }
  };

  // Period filter tabs
  const periodTabs = [
    { value: 'day', label: 'Hôm nay', icon: <TodayIcon /> },
    { value: 'week', label: 'Tuần này', icon: <DateRangeIcon /> },
    { value: 'month', label: 'Tháng này', icon: <CalendarIcon /> },
    { value: 'year', label: 'Năm nay', icon: <YearIcon /> },
    { value: 'custom', label: 'Tùy chọn', icon: <FilterIcon /> }
  ];

  // Debug: Log render
  console.log('[AttendanceManagement] Rendering. Loading:', loading, 'Data:', attendanceData.length, 'Filtered:', filteredData?.length || 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
              Quản lý Chấm công
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Theo dõi và quản lý dữ liệu chấm công của nhân viên
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={filteredData.length === 0}
            >
              Xuất CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              Làm mới
            </Button>
          </Box>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng bản ghi</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats.totalRecords}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <ScheduleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Hoàn thành</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats.completedRecords}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <CheckCircleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Tạm ngưng</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats.pendingRecords}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <WarningIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng giờ làm</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats.totalHours}h</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <AccessTimeIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng lương</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats.totalSalary} USDT</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <MoneyIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Period Filter Tabs */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={filterPeriod}
              onChange={(e, v) => {
                const now = new Date();
                switch (v) {
                  case 'day':
                    setCustomStartDate(now);
                    setCustomEndDate(now);
                    break;
                  case 'week':
                    setCustomStartDate(startOfWeek(now, { weekStartsOn: 1 }));
                    setCustomEndDate(endOfWeek(now, { weekStartsOn: 1 }));
                    break;
                  case 'month':
                    setCustomStartDate(startOfMonth(now));
                    setCustomEndDate(endOfMonth(now));
                    break;
                  case 'year':
                    setCustomStartDate(startOfYear(now));
                    setCustomEndDate(endOfYear(now));
                    break;
                  default:
                    break;
                }
                setFilterPeriod(v);
              }}
              variant="scrollable"
              scrollButtons="auto"
            >
              {periodTabs.map(tab => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  icon={tab.icon}
                  iconPosition="start"
                  sx={{ minHeight: 64 }}
                />
              ))}
            </Tabs>
          </Box>

          {/* Custom Date Range */}
          {filterPeriod === 'custom' && (
            <Box p={2} display="flex" gap={2} alignItems="center" bgcolor="grey.50">
              <DatePicker
                label="Từ ngày"
                value={customStartDate}
                onChange={(value) => value && setCustomStartDate(value)}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
              <DatePicker
                label="Đến ngày"
                value={customEndDate}
                onChange={(value) => value && setCustomEndDate(value)}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
              <Button variant="contained" onClick={fetchData} disabled={!customStartDate || !customEndDate}>
                Áp dụng
              </Button>
            </Box>
          )}
        </Card>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Tìm kiếm nhân viên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Phòng ban</InputLabel>
                  <Select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    label="Phòng ban"
                  >
                    <MenuItem value="all">Tất cả phòng ban</MenuItem>
                    {departments.map(dept => (
                      <MenuItem key={dept.phong_ban_id} value={dept.phong_ban_id}>
                        {dept.ten_phong_ban}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Nhân viên</InputLabel>
                  <Select
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    label="Nhân viên"
                  >
                    <MenuItem value="all">Tất cả nhân viên</MenuItem>
                    {employees
                      .filter(emp => filterDepartment === 'all' || emp.phong_ban_id === filterDepartment)
                      .map(emp => (
                        <MenuItem key={emp.employee_did} value={emp.employee_did}>
                          {emp.ho_ten || emp.employee_did}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Trạng thái</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Trạng thái"
                  >
                    <MenuItem value="all">Tất cả trạng thái</MenuItem>
                    <MenuItem value="Đã hoàn thành">Đã hoàn thành</MenuItem>
                    <MenuItem value="Tạm ngưng">Tạm ngưng</MenuItem>
                    <MenuItem value="Chưa check-in">Chưa check-in</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Ngày</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nhân viên</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Phòng ban</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Giờ vào</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Giờ ra</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Tổng giờ</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Lương (USDT)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Quên check-out</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>On-chain</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, index) => (
                    <TableRow key={index}>
                      {[...Array(10)].map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton animation="wave" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        <ScheduleIcon sx={{ fontSize: 64, color: 'grey.300' }} />
                        <Typography variant="h6" color="text.secondary">
                          Không có dữ liệu chấm công
                        </Typography>
                        <Typography variant="body2" color="text.disabled">
                          Thử thay đổi bộ lọc hoặc khoảng thời gian
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((record, index) => {
                      const employee = getEmployeeInfo(record.employee_did);
                      return (
                        <TableRow
                          key={record._id || index}
                          hover
                          sx={{
                            '&:hover': { bgcolor: 'action.hover' },
                            borderLeft: record.trang_thai_cham_cong === 'Tạm ngưng'
                              ? '4px solid #ff9800'
                              : record.trang_thai_cham_cong === 'Đã hoàn thành'
                                ? '4px solid #4caf50'
                                : '4px solid transparent'
                          }}
                        >
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <TodayIcon fontSize="small" color="action" />
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {format(new Date(record.ngay), 'dd/MM/yyyy')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {format(new Date(record.ngay), 'EEEE', { locale: vi })}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1.5}>
                              {employee.ho_ten ? (
                              <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                                  {employee.ho_ten[0]}
                              </Avatar>
                              ) : null}
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {employee.ho_ten || record.employee_did}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {employee.chuc_vu || record.employee_did || '—'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={<BusinessIcon />}
                              label={getDepartmentName(employee.phong_ban_id)}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color={record.gio_vao ? 'success.main' : 'text.disabled'}
                            >
                              {record.gio_vao || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color={record.gio_ra ? 'info.main' : 'text.disabled'}
                            >
                              {record.gio_ra || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight={600}>
                              {record.tong_gio_lam ? `${record.tong_gio_lam}h` : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                              <MoneyIcon fontSize="small" sx={{ color: 'warning.main' }} />
                              <Typography variant="body2" fontWeight={600} color="warning.dark">
                                {record.luong_tinh_theo_gio ? formatCurrency(record.luong_tinh_theo_gio) : '—'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            {getStatusChip(record)}
                          </TableCell>
                          <TableCell align="center">
                            {hasMissedCheckoutReport(record) ? (
                              <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                                {getMissedStatusChip(record)}
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleOpenMissedDialog(record)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Xem / duyệt
                                </Button>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {(() => {
                              // Ưu tiên: 1. salary_transaction_hash, 2. transaction_hash từ map, 3. transaction_hash từ record
                              const txHash = record.salary_transaction_hash || 
                                            (record._id && attendanceTxHashes[record._id]) || 
                                            record.transaction_hash;
                              
                              if (!txHash) {
                                return <Typography variant="caption" color="text.disabled">—</Typography>;
                              }
                              
                              // Validate transaction hash format (0x + 64 hex characters = 66 total)
                              const isValidHash = typeof txHash === 'string' &&
                                                 txHash.startsWith('0x') && 
                                                 txHash.length === 66 && 
                                                 /^0x[a-fA-F0-9]{64}$/.test(txHash);
                              
                              if (isValidHash) {
                                return (
                                  <Tooltip title={`Xem transaction trên Etherscan (Sepolia Testnet)\nHash: ${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component={Link}
                                      startIcon={<LinkIcon fontSize="small" />}
                                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{ textTransform: 'none' }}
                                    >
                                      {record.salary_transaction_hash ? 'TX Lương' : 'TX Anchor'}
                                    </Button>
                                  </Tooltip>
                                );
                              } else {
                                // Không hiển thị gì nếu hash không hợp lệ (thay vì hiển thị warning)
                                return <Typography variant="caption" color="text.disabled">—</Typography>;
                              }
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            component="div"
            count={filteredData.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            labelRowsPerPage="Số hàng mỗi trang:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} trong ${count !== -1 ? count : `hơn ${to}`}`
            }
          />
        </Card>

        {/* Department Summary */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Tổng hợp theo Phòng ban
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {departments.map(dept => {
                const deptRecords = attendanceData.filter(r => {
                  const emp = getEmployeeInfo(r.employee_did);
                  return emp.phong_ban_id === dept.phong_ban_id;
                });
                const deptHours = deptRecords.reduce((sum, r) => sum + (r.tong_gio_lam || 0), 0);
                const deptSalary = deptRecords.reduce((sum, r) => sum + (r.luong_tinh_theo_gio || 0), 0);
                const deptEmployees = [...new Set(deptRecords.map(r => r.employee_did))].length;

                return (
                  <Grid item xs={12} sm={6} md={4} key={dept.phong_ban_id}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: 2
                        }
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={2} mb={1.5}>
                        <Avatar sx={{ bgcolor: 'primary.light' }}>
                          <BusinessIcon />
                        </Avatar>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {dept.ten_phong_ban}
                        </Typography>
                      </Box>
                      <Grid container spacing={1}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Nhân viên</Typography>
                          <Typography variant="h6" fontWeight="bold">{deptEmployees}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Tổng giờ</Typography>
                          <Typography variant="h6" fontWeight="bold">{Math.round(deptHours)}h</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Lương</Typography>
                          <Typography variant="h6" fontWeight="bold" color="warning.main">
                            ${Math.round(deptSalary)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>

        {/* Dialog phê duyệt báo quên check-out */}
        <Dialog
          open={missedDialogOpen}
          onClose={() => setMissedDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <WarningIcon color="warning" />
              <Typography variant="h6" fontWeight="bold">
                Duyệt báo quên check-out
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedMissedRecord && (
              <Box display="flex" flexDirection="column" gap={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Nhân viên
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {getEmployeeInfo(selectedMissedRecord.employee_did)?.ho_ten ||
                      selectedMissedRecord.employee_did}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Ngày
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedMissedRecord.ngay), 'dd/MM/yyyy')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Mô tả của nhân viên
                  </Typography>
                  <Typography variant="body2">
                    {selectedMissedRecord.quen_checkout_mo_ta || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Số giờ ước tính nhân viên đã khai báo
                  </Typography>
                  <Typography variant="body2">
                    {selectedMissedRecord.quen_checkout_gio_xac_nhan != null
                      ? `${selectedMissedRecord.quen_checkout_gio_xac_nhan}h`
                      : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Bằng chứng
                  </Typography>
                  {Array.isArray(selectedMissedRecord.quen_checkout_bang_chung) &&
                  selectedMissedRecord.quen_checkout_bang_chung.length > 0 ? (
                    selectedMissedRecord.quen_checkout_bang_chung.map((url, idx) => (
                      <Box key={idx}>
                        <Link
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {url}
                        </Link>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2">Không có bằng chứng đính kèm</Typography>
                  )}
                </Box>
                <TextField
                  label="Số giờ admin xác nhận (giờ)"
                  type="number"
                  value={missedAdminHours}
                  onChange={(e) => setMissedAdminHours(e.target.value)}
                  fullWidth
                  inputProps={{ min: 0, step: 0.5 }}
                  helperText="Nếu để trống sẽ dùng số giờ nhân viên đã khai báo (nếu có)"
                />
                <TextField
                  label="Ghi chú của admin"
                  multiline
                  minRows={2}
                  value={missedAdminReason}
                  onChange={(e) => setMissedAdminReason(e.target.value)}
                  fullWidth
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMissedDialogOpen(false)}>
              Đóng
            </Button>
            <Button
              color="error"
              variant="outlined"
              onClick={() => handleSubmitMissedDecision('reject')}
              disabled={missedAdminLoading}
            >
              {missedAdminLoading ? 'Đang xử lý...' : 'Từ chối & đánh nghỉ phép'}
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={() => handleSubmitMissedDecision('approve')}
              disabled={missedAdminLoading}
            >
              {missedAdminLoading ? 'Đang xử lý...' : 'Chấp thuận (50% lương)'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default AttendanceManagement;
