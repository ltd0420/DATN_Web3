import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, LinearProgress,
  Alert, CircularProgress, Avatar, Tooltip, Paper, Divider,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, InputAdornment,
  Snackbar, Badge, Tabs, Tab, alpha, IconButton, useTheme,
  Slider, Checkbox, FormControlLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi } from 'date-fns/locale';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as PriorityHighIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Work as WorkIcon,
  Close as CloseIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  StarHalf as StarHalfIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
  FilterList as FilterListIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  GetApp as GetAppIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Speed as SpeedIcon,
  PlayArrow as PlayArrowIcon,
  Info as InfoIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import { useAuth } from '../../AuthContext';
import { format } from 'date-fns';

function TaskManagement({ user, employeeData }) {
  const theme = useTheme();
  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [rewardInfoDialogOpen, setRewardInfoDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const isFetchingRef = useRef(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [dateRangeType, setDateRangeType] = useState('all'); // all, today, week, month, year, custom
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [progressNote, setProgressNote] = useState('');
  const [progressFiles, setProgressFiles] = useState([]);
  const [progressUploading, setProgressUploading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fetchTasks = useCallback(async () => {
    if (!user?.employee_did) return;
    // Tránh gọi lại nếu đang fetch
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError('');
      const response = await apiService.getTasksByEmployee(user.employee_did);
      setTasks(response || []);
    } catch (err) {
      // Chỉ log lỗi thực sự, không log các lỗi network nhỏ
      if (err.response?.status !== 404 && err.code !== 'ERR_NETWORK') {
        console.error('Fetch tasks error:', err);
      }
      // Chỉ set error cho lỗi quan trọng
      if (err.response?.status >= 500) {
        setError('Không thể tải danh sách công việc.');
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user?.employee_did]);

  const fetchPendingTasks = useCallback(async () => {
    if (!user?.employee_did) return;
    
    try {
      console.log('[TaskManagement] Fetching pending tasks for:', user.employee_did);
      const response = await apiService.getPendingTasksByEmployee(user.employee_did);
      console.log('[TaskManagement] Pending tasks response:', response);
      setPendingTasks(response || []);
      console.log('[TaskManagement] Set pending tasks:', response?.length || 0, 'tasks');
    } catch (err) {
      console.error('[TaskManagement] Fetch pending tasks error:', err);
      // Chỉ log lỗi thực sự, không log các lỗi network nhỏ
      if (err.response?.status !== 404 && err.code !== 'ERR_NETWORK' && err.code !== 'ERR_FILE_NOT_FOUND') {
        console.error('Fetch pending tasks error:', err);
      }
      // Set empty array on error để tránh hiển thị stale data
      setPendingTasks([]);
    }
  }, [user?.employee_did]);

  useEffect(() => {
    if (user?.employee_did) {
      // Fetch tasks và pending tasks độc lập
      fetchTasks();
      // Delay một chút để tránh conflict với fetchTasks
      const timeoutId = setTimeout(() => {
        fetchPendingTasks();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [user?.employee_did, fetchTasks, fetchPendingTasks]);

  // Debug: Log pending tasks changes
  useEffect(() => {
    console.log('[TaskManagement] pendingTasks updated:', pendingTasks.length, 'tasks', pendingTasks);
  }, [pendingTasks]);

  // Auto-refresh tasks mỗi 2 phút để cập nhật khi admin phê duyệt milestone
  // Chỉ refresh khi component đã mount và user đã được load
  // Tắt auto-refresh để tránh làm mới trang liên tục - người dùng có thể bấm nút "Làm mới" thủ công
  // useEffect(() => {
  //   if (!user?.employee_did || loading) return;

  //   let intervalId = null;
    
  //   // Delay initial auto-refresh để tránh request ngay sau khi mount
  //   const timeoutId = setTimeout(() => {
  //     intervalId = setInterval(() => {
  //       // Chỉ refresh nếu không đang fetch và component vẫn mounted
  //       if (!isFetchingRef.current && user?.employee_did) {
  //         fetchTasks();
  //         fetchPendingTasks();
  //       }
  //     }, 120000); // Refresh mỗi 2 phút
  //   }, 10000); // Đợi 10 giây trước khi bắt đầu auto-refresh

  //   return () => {
  //     clearTimeout(timeoutId);
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
  //   };
  // }, [user?.employee_did, loading, fetchTasks, fetchPendingTasks]);

  const handleAcceptTask = async (task) => {
    try {
      await apiService.acceptTask(task.task_id);
      setSnackbar({ open: true, message: 'Đã đồng ý nhận công việc thành công!', severity: 'success' });
      await fetchTasks();
      await fetchPendingTasks();
      setAcceptDialogOpen(false);
      setSelectedTask(null);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Không thể đồng ý công việc.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleRejectTask = async (task) => {
    if (window.confirm('Bạn có chắc chắn muốn từ chối công việc này?')) {
      try {
        await apiService.updateTask(task.task_id, { trang_thai: 'Hủy bỏ' });
        setSnackbar({ open: true, message: 'Đã từ chối công việc.', severity: 'info' });
        await fetchPendingTasks();
      } catch (err) {
        setSnackbar({ open: true, message: 'Không thể từ chối công việc.', severity: 'error' });
      }
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const handleUpdateProgress = (task) => {
    setSelectedTask(task);
    setProgressNote('');
    setProgressValue(task?.tien_do || 0);
    setProgressFiles([]);
    setProgressUploading(false);
    setProgressDialogOpen(true);
  };

  const handleProgressSubmit = async (value) => {
    try {
      if (progressFiles.length === 0) {
        setSnackbar({
          open: true,
          message: 'Vui lòng chọn ít nhất một tệp đính kèm trước khi lưu tiến độ.',
          severity: 'warning'
        });
        return;
      }

      setProgressUploading(true);

      const formData = new FormData();
      progressFiles.forEach((file) => {
        formData.append('files', file);
      });

      const uploadResponse = await apiService.uploadMultipleFiles(formData);

      if (!uploadResponse?.success || !uploadResponse.files || uploadResponse.files.length === 0) {
        throw new Error(uploadResponse?.message || 'Không thể tải lên tệp.');
      }

      await apiService.updateTaskProgress(selectedTask.task_id, {
        tien_do: value,
        note: progressNote,
        files: uploadResponse.files
      });
      await fetchTasks();
      setProgressDialogOpen(false);
      setSelectedTask(null);
      setProgressNote('');
      setProgressFiles([]);
      setSnackbar({ open: true, message: `Đã cập nhật tiến độ ${value}%.`, severity: 'success' });
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Không thể cập nhật tiến độ.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setProgressUploading(false);
    }
  };

  const handleMarkComplete = (task) => {
    setSelectedTask(task);
    setProgressNote('Đã hoàn thành công việc');
    setProgressValue(100);
    setProgressFiles([]);
    setProgressDialogOpen(true);
  };

  const handleProgressFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const maxSize = 1024 * 1024 * 1024; // 1GB
    const invalidFiles = files.filter(f => f.size > maxSize);
    if (invalidFiles.length > 0) {
      setSnackbar({
        open: true,
        message: `Một số tệp vượt quá 1GB: ${invalidFiles.map(f => f.name).join(', ')}`,
        severity: 'error'
      });
      return;
    }

    setProgressFiles(prev => [...prev, ...files]);
    event.target.value = '';
  };

  const removeProgressFile = (index) => {
    setProgressFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteTask = async (taskId) => {
    // Tìm task để hiển thị thông tin
    const task = tasks.find(t => t.task_id === taskId);
    const taskName = task?.ten_cong_viec || 'công việc này';
    
    // Cảnh báo nếu là công việc đã hoàn thành
    const confirmMessage = task && task.trang_thai === 'Hoàn thành'
      ? `⚠️ Cảnh báo: Đây là công việc đã hoàn thành. Bạn có chắc chắn muốn xóa "${taskName}"? Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn trong database.`
      : `Bạn có chắc chắn muốn xóa "${taskName}"? Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn trong database.`;

    if (window.confirm(confirmMessage)) {
      try {
        await apiService.deleteTask(taskId);
        await fetchTasks();
        setSnackbar({ open: true, message: 'Đã xóa công việc thành công!', severity: 'success' });
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Không thể xóa công việc.';
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      }
    }
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Validate file size (max 1GB per file)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    const invalidFiles = files.filter(f => f.size > maxSize);
    if (invalidFiles.length > 0) {
      setSnackbar({
        open: true,
        message: `Một số tệp vượt quá 1GB: ${invalidFiles.map(f => f.name).join(', ')}`,
        severity: 'error'
      });
      return;
    }

    if (!selectedTask) return;

    setUploadingFiles(true);
    try {
      // Upload files
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await apiService.uploadMultipleFiles(formData);
      
      if (response.success && response.files) {
        // Attach files to task
        await apiService.attachFileToTask(selectedTask.task_id, { files: response.files });
        await fetchTasks();
        
        // Update selected task
        const updatedTask = await apiService.getTaskById(selectedTask.task_id);
        setSelectedTask(updatedTask);
        
        setSnackbar({
          open: true,
          message: `Đã đính kèm ${response.files.length} tệp thành công!`,
          severity: 'success'
        });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Không thể tải lên tệp.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setUploadingFiles(false);
      event.target.value = ''; // Reset input
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      // Extract filename from file_uri
      let filename = '';
      if (file.file_uri) {
        const uriParts = file.file_uri.split('/');
        filename = decodeURIComponent(uriParts[uriParts.length - 1]);
      } else {
        filename = file.file_name || '';
      }
      
      // Use API service to download file with proper authentication
      const response = await apiService.downloadFile(encodeURIComponent(filename));
      
      // Create blob from response
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Decode filename properly for Vietnamese characters
      const decodedFilename = decodeURIComponent(file.file_name || filename);
      link.setAttribute('download', decodedFilename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      setSnackbar({ 
        open: true, 
        message: 'Tải xuống tệp thành công!', 
        severity: 'success' 
      });
    } catch (err) {
      console.error('Download file error:', err);
      setSnackbar({ 
        open: true, 
        message: err.response?.data?.message || 'Không thể tải xuống tệp. Vui lòng thử lại.', 
        severity: 'error' 
      });
    }
  };

  const handleDeleteFile = async (taskId, file) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tệp "${file.file_name}"?`)) {
      return;
    }

    try {
      await apiService.deleteFileFromTask(taskId, file.file_uri);
      await fetchTasks();
      
      // Update selected task
      const updatedTask = await apiService.getTaskById(taskId);
      setSelectedTask(updatedTask);
      
      setSnackbar({ open: true, message: 'Đã xóa tệp thành công!', severity: 'success' });
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Không thể xóa tệp.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Chờ bắt đầu': return 'default';
      case 'Đang thực hiện': return 'primary';
      case 'Chờ review': return 'warning';
      case 'Hoàn thành': return 'success';
      case 'Tạm dừng': return 'error';
      case 'Hủy bỏ': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Thấp': return 'success';
      case 'Trung bình': return 'warning';
      case 'Cao': return 'error';
      case 'Khẩn cấp': return 'error';
      default: return 'default';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Dễ': return 'success';
      case 'Vừa': return 'warning';
      case 'Khó': return 'error';
      default: return 'default';
    }
  };

  const getDifficultyIcon = (difficulty) => {
    switch (difficulty) {
      case 'Dễ': return <StarBorderIcon fontSize="small" />;
      case 'Vừa': return <StarHalfIcon fontSize="small" />;
      case 'Khó': return <StarIcon fontSize="small" />;
      default: return null;
    }
  };

  const getRewardInfo = (task) => {
    const rules = {
      'Dễ': { rewardOnTime: 5, rewardLate: 2.5 },
      'Vừa': { rewardOnTime: 15, rewardLate: 7.5 },
      'Khó': { rewardOnTime: 20, rewardLate: 10 }
    };
    
    const difficulty = task.muc_do_kho || 'Vừa';
    const rule = rules[difficulty] || rules['Vừa'];
    
    return {
      reward: task.tien_thuong || 0,
      penalty: task.tien_phat || 0,
      potentialRewardOnTime: rule.rewardOnTime || 0,
      potentialRewardLate: rule.rewardLate || 0
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const formatDeadlineTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getFileUploaderLabel = (file, task) => {
    if (file.uploaded_by === task.nguoi_thuc_hien_did) return 'Nhân viên';
    if (file.uploaded_by === task.nguoi_giao_did) return 'Admin';
    if (file.uploaded_by) return 'Khác';
    return 'Không rõ';
  };

  const isOverdue = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  // Helper function to get date range based on dateRangeType
  const getDateRange = useCallback(() => {
    const now = new Date();
    let rangeStart = null;
    let rangeEnd = null;

    switch (dateRangeType) {
      case 'today':
        rangeStart = startOfDay(now);
        rangeEnd = endOfDay(now);
        break;
      case 'week':
        rangeStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        rangeEnd = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        rangeStart = startOfMonth(now);
        rangeEnd = endOfMonth(now);
        break;
      case 'year':
        rangeStart = startOfYear(now);
        rangeEnd = endOfYear(now);
        break;
      case 'custom':
        if (startDate && endDate) {
          rangeStart = startOfDay(startDate);
          rangeEnd = endOfDay(endDate);
        }
        break;
      default:
        return { rangeStart: null, rangeEnd: null };
    }

    return { rangeStart, rangeEnd };
  }, [dateRangeType, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.trang_thai === 'Hoàn thành').length;
    const inProgress = tasks.filter(t => t.trang_thai === 'Đang thực hiện').length;
    const overdue = tasks.filter(t => isOverdue(t.ngay_ket_thuc_du_kien) && t.trang_thai !== 'Hoàn thành').length;
    const totalReward = tasks.reduce((sum, t) => sum + (t.tien_thuong || 0), 0);
    // Đếm task chờ review: chỉ tính các task có trạng thái "Chờ review"
    const pendingReview = tasks.filter(t => t.trang_thai === 'Chờ review').length;

    return { total, completed, inProgress, overdue, totalReward, pending: pendingTasks.length, pendingReview };
  }, [tasks, pendingTasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    const { rangeStart, rangeEnd } = getDateRange();
    
    return tasks.filter(task => {
      if (filterStatus !== 'all' && task.trang_thai !== filterStatus) return false;
      if (filterPriority !== 'all' && task.do_uu_tien !== filterPriority) return false;
      if (filterDifficulty !== 'all' && task.muc_do_kho !== filterDifficulty) return false;
      if (searchTerm && !task.ten_cong_viec.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // Date range filter
      if (rangeStart && rangeEnd && task.ngay_ket_thuc_du_kien) {
        const taskDate = new Date(task.ngay_ket_thuc_du_kien);
        if (taskDate < rangeStart || taskDate > rangeEnd) {
          return false;
        }
      }
      
      // Tab filter
      if (activeTab === 1 && task.trang_thai !== 'Đang thực hiện') return false;
      // Tab "Chờ review": chỉ hiển thị task có trạng thái "Chờ review"
      if (activeTab === 2 && task.trang_thai !== 'Chờ review') return false;
      if (activeTab === 3 && task.trang_thai !== 'Hoàn thành') return false;
      if (activeTab === 4 && (!isOverdue(task.ngay_ket_thuc_du_kien) || task.trang_thai === 'Hoàn thành')) return false;

      return true;
    });
  }, [tasks, filterStatus, filterPriority, filterDifficulty, searchTerm, activeTab, getDateRange]);

  const paginatedTasks = filteredTasks.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Công việc của tôi
        </Typography>
          <Tooltip title="Xem cách tính lương và thưởng">
            <IconButton
              color="primary"
              onClick={() => setRewardInfoDialogOpen(true)}
              sx={{ 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
              }}
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchTasks();
            fetchPendingTasks();
          }}
          disabled={loading}
        >
          Làm mới
        </Button>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3, borderRadius: 2 }} 
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Tổng công việc
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {stats.total}
                  </Typography>
                </Box>
                <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Đang thực hiện
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {stats.inProgress}
                  </Typography>
                </Box>
                <WorkIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Hoàn thành
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {stats.completed}
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Tổng thưởng
                  </Typography>
                  <Box display="flex" alignItems="baseline" gap={0.5}>
                    <Typography variant="h4" fontWeight="bold" color="text.primary">
                      {stats.totalReward}
                    </Typography>
                    <Typography variant="subtitle2" color="text.secondary">
                      USDT
                    </Typography>
                  </Box>
                </Box>
                <MoneyIcon color="action" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Chờ đồng ý
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="text.primary">
                    {stats.pending}
                  </Typography>
                </Box>
                <Badge badgeContent={stats.pending} color="error">
                  <PendingIcon color="action" sx={{ fontSize: 40 }} />
                </Badge>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pending Tasks Section */}
      {pendingTasks.length > 0 && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'warning.main' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <PendingIcon color="warning" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight="bold" color="warning.main">
                  Công việc chờ đồng ý
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bạn có {pendingTasks.length} công việc mới cần xác nhận
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={2}>
              {pendingTasks.map((task) => {
                const rewardInfo = getRewardInfo(task);
                return (
                  <Grid item xs={12} md={6} key={task.task_id}>
                    <Paper
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'warning.main',
                        borderRadius: 1
                      }}
                    >
                      <Box mb={2}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {task.ten_cong_viec}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {task.mo_ta || 'Không có mô tả'}
                        </Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                          <Chip
                            icon={getDifficultyIcon(task.muc_do_kho || 'Vừa')}
                            label={task.muc_do_kho || 'Vừa'}
                            size="small"
                            color={getDifficultyColor(task.muc_do_kho || 'Vừa')}
                          />
                          <Chip
                            label={task.do_uu_tien}
                            size="small"
                            color={getPriorityColor(task.do_uu_tien)}
                          />
                          <Chip
                            label={`Deadline: ${formatDate(task.ngay_ket_thuc_du_kien)}`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                            <Box display="flex" gap={1} alignItems="center">
                          <MoneyIcon fontSize="small" color="success" />
                          <Typography variant="body2" fontWeight="medium" color="success.main">
                            Thưởng đúng hạn: +{rewardInfo.potentialRewardOnTime} USDT
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            / Quá hạn: +{rewardInfo.potentialRewardLate} USDT
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" gap={2}>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<ThumbUpIcon />}
                          onClick={() => {
                            setSelectedTask(task);
                            setAcceptDialogOpen(true);
                          }}
                          fullWidth
                        >
                          Đồng ý
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<ThumbDownIcon />}
                          onClick={() => handleRejectTask(task)}
                          fullWidth
                        >
                          Từ chối
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => { setActiveTab(v); setPage(0); }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <AssignmentIcon fontSize="small" />
                <span>Tất cả</span>
                <Chip label={stats.total} size="small" />
              </Box>
            }
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <WorkIcon fontSize="small" />
                <span>Đang làm</span>
                <Chip label={stats.inProgress} size="small" color="primary" />
              </Box>
            }
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon fontSize="small" />
                <span>Chờ review</span>
                <Chip label={stats.pendingReview} size="small" color="warning" />
              </Box>
            }
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircleIcon fontSize="small" />
                <span>Hoàn thành</span>
                <Chip label={stats.completed} size="small" color="success" />
              </Box>
            }
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <PriorityHighIcon fontSize="small" />
                <span>Quá hạn</span>
                <Chip label={stats.overdue} size="small" color="error" />
              </Box>
            }
          />
        </Tabs>
      </Card>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm công việc..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Trạng thái</InputLabel>
                <Select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} label="Trạng thái">
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="Chờ bắt đầu">Chờ bắt đầu</MenuItem>
                  <MenuItem value="Đang thực hiện">Đang thực hiện</MenuItem>
                  <MenuItem value="Chờ review">Chờ review</MenuItem>
                  <MenuItem value="Hoàn thành">Hoàn thành</MenuItem>
                  <MenuItem value="Tạm dừng">Tạm dừng</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Độ ưu tiên</InputLabel>
                <Select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(0); }} label="Độ ưu tiên">
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="Thấp">Thấp</MenuItem>
                  <MenuItem value="Trung bình">Trung bình</MenuItem>
                  <MenuItem value="Cao">Cao</MenuItem>
                  <MenuItem value="Khẩn cấp">Khẩn cấp</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Mức độ khó</InputLabel>
                <Select value={filterDifficulty} onChange={(e) => { setFilterDifficulty(e.target.value); setPage(0); }} label="Mức độ khó">
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="Dễ">Dễ</MenuItem>
                  <MenuItem value="Vừa">Vừa</MenuItem>
                  <MenuItem value="Khó">Khó</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Lọc theo thời gian</InputLabel>
                <Select 
                  value={dateRangeType} 
                  onChange={(e) => { 
                    setDateRangeType(e.target.value); 
                    if (e.target.value !== 'custom') {
                      setStartDate(null);
                      setEndDate(null);
                    }
                    setPage(0); 
                  }} 
                  label="Lọc theo thời gian"
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="today">Hôm nay</MenuItem>
                  <MenuItem value="week">Tuần này</MenuItem>
                  <MenuItem value="month">Tháng này</MenuItem>
                  <MenuItem value="year">Năm này</MenuItem>
                  <MenuItem value="custom">Tùy chọn</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {dateRangeType === 'custom' && (
              <>
                <Grid item xs={12} md={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
                    <DatePicker
                      label="Ngày bắt đầu"
                      value={startDate}
                      onChange={(newValue) => {
                        setStartDate(newValue);
                        setPage(0);
                      }}
                      renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
                    <DatePicker
                      label="Ngày kết thúc"
                      value={endDate}
                      onChange={(newValue) => {
                        setEndDate(newValue);
                        setPage(0);
                      }}
                      minDate={startDate}
                      renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                    />
                  </LocalizationProvider>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Công việc</strong></TableCell>
                <TableCell><strong>Mức độ</strong></TableCell>
                <TableCell><strong>Trạng thái</strong></TableCell>
                <TableCell><strong>Deadline</strong></TableCell>
                <TableCell><strong>Tiến độ</strong></TableCell>
                <TableCell align="right"><strong>Thưởng/Phạt</strong></TableCell>
                <TableCell align="center"><strong>Thao tác</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                      <Typography variant="h6" color="text.secondary">
                        Không có công việc
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' || filterDifficulty !== 'all'
                          ? 'Không tìm thấy công việc phù hợp với bộ lọc'
                          : 'Chưa có công việc nào được giao cho bạn'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map((task) => {
                  const rewardInfo = getRewardInfo(task);
                  const isOverdueTask = isOverdue(task.ngay_ket_thuc_du_kien) && task.trang_thai !== 'Hoàn thành';
                  
                  return (
                    <TableRow key={task.task_id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {task.ten_cong_viec}
                          </Typography>
                          {task.mo_ta && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300, display: 'block' }}>
                              {task.mo_ta}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getDifficultyIcon(task.muc_do_kho || 'Vừa')}
                          label={task.muc_do_kho || 'Vừa'}
                          size="small"
                          color={getDifficultyColor(task.muc_do_kho || 'Vừa')}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={task.trang_thai}
                            size="small"
                            color={getStatusColor(task.trang_thai)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(task.ngay_ket_thuc_du_kien)}
                        </Typography>
                        {isOverdueTask && (
                          <Chip label="Quá hạn" size="small" color="error" sx={{ mt: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={task.tien_do || 0}
                            sx={{ flexGrow: 1, maxWidth: 100, height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="body2" fontWeight="medium">
                            {task.tien_do || 0}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {task.trang_thai === 'Hoàn thành' ? (
                          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                            {rewardInfo.reward > 0 && (
                              <Chip
                                icon={<TrendingUpIcon />}
                                label={`+${rewardInfo.reward} USDT`}
                                size="small"
                                color="success"
                              />
                            )}
                            {rewardInfo.penalty > 0 && (
                              <Chip
                                icon={<TrendingDownIcon />}
                                label={`-${rewardInfo.penalty} USDT`}
                                size="small"
                                color="error"
                              />
                            )}
                          </Box>
                        ) : (
                          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                            <Typography variant="caption" color="text.secondary">
                              Tiềm năng:
                            </Typography>
                            <Chip
                              label={`Đúng hạn: +${rewardInfo.potentialRewardOnTime} USDT`}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                            <Chip
                              label={`Quá hạn: +${rewardInfo.potentialRewardLate} USDT`}
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={0.5}>
                          <Tooltip title="Xem chi tiết">
                            <IconButton
                              size="small"
                              onClick={() => handleTaskClick(task)}
                            >
                              <AssignmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {task.trang_thai !== 'Hoàn thành' && task.trang_thai !== 'Chờ review' && (
                            <Tooltip title="Cập nhật tiến độ">
                              <IconButton
                                size="small"
                                onClick={() => handleUpdateProgress(task)}
                                color="primary"
                              >
                                <TimelineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {task.trang_thai === 'Đang thực hiện' && (
                            <Tooltip title="Đánh dấu hoàn thành">
                              <IconButton
                                size="small"
                                onClick={() => handleMarkComplete(task)}
                                color="success"
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Nút xóa - ẩn khi task đang trong trạng thái "Đang thực hiện" */}
                          {task.trang_thai !== 'Đang thực hiện' && (
                            <Tooltip title="Xóa vĩnh viễn">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteTask(task.task_id)}
                              >
                                <DeleteIcon fontSize="small" />
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
        <TablePagination
          component="div"
          count={filteredTasks.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Số hàng:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        />
      </Card>

      {/* Accept Task Dialog */}
      <Dialog
        open={acceptDialogOpen}
        onClose={() => { setAcceptDialogOpen(false); setSelectedTask(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 3,
            bgcolor: 'grey.900',
            color: 'grey.100'
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: 'grey.100',
          bgcolor: 'grey.800',
          borderBottom: '1px solid',
          borderColor: 'grey.700'
        }}>
          <ThumbUpIcon color="success" />
          Xác nhận đồng ý công việc
        </DialogTitle>
        <DialogContent sx={{ bgcolor: 'grey.900', color: 'grey.100' }}>
          {selectedTask && (
            <Box>
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 3,
                  bgcolor: 'grey.800',
                  color: 'grey.100',
                  '& .MuiAlert-icon': {
                    color: 'info.main'
                  }
                }}
              >
                Bạn có chắc chắn muốn đồng ý nhận công việc này? Sau khi đồng ý, công việc sẽ xuất hiện trong danh sách công việc của bạn.
              </Alert>
              <Typography variant="h6" gutterBottom sx={{ color: 'grey.100' }}>
                {selectedTask.ten_cong_viec}
              </Typography>
              <Typography variant="body2" color="grey.400" paragraph>
                {selectedTask.mo_ta || 'Không có mô tả'}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="grey.400">
                    Mức độ khó
                  </Typography>
                  <Chip
                    icon={getDifficultyIcon(selectedTask.muc_do_kho || 'Vừa')}
                    label={selectedTask.muc_do_kho || 'Vừa'}
                    color={getDifficultyColor(selectedTask.muc_do_kho || 'Vừa')}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="grey.400">
                    Deadline
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ mt: 0.5, color: 'grey.200' }}>
                    {formatDate(selectedTask.ngay_ket_thuc_du_kien)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ 
                    p: 2, 
                    bgcolor: 'grey.800', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.700'
                  }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: 'grey.200' }}>
                      Phần thưởng/Phạt
                    </Typography>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      <Chip
                        icon={<TrendingUpIcon />}
                        label={`Đúng hạn: +${getRewardInfo(selectedTask).potentialRewardOnTime} USDT`}
                        color="success"
                      />
                      <Chip
                        icon={<TrendingDownIcon />}
                        label={`Quá hạn: +${getRewardInfo(selectedTask).potentialRewardLate} USDT`}
                        color="warning"
                      />
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          bgcolor: 'grey.800', 
          borderTop: '1px solid',
          borderColor: 'grey.700',
          px: 3,
          py: 2
        }}>
          <Button
            onClick={() => { setAcceptDialogOpen(false); setSelectedTask(null); }}
            variant="outlined"
            sx={{
              color: 'grey.300',
              borderColor: 'grey.600',
              '&:hover': {
                borderColor: 'grey.500',
                bgcolor: 'grey.700'
              }
            }}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ThumbUpIcon />}
            onClick={() => handleAcceptTask(selectedTask)}
            sx={{
              bgcolor: 'success.main',
              '&:hover': {
                bgcolor: 'success.dark'
              }
            }}
          >
            Đồng ý nhận công việc
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2
        }}>
          <AssignmentIcon color="primary" />
          {selectedTask?.ten_cong_viec}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedTask && (
            <Box>
              <Box display="flex" gap={1} mb={3} flexWrap="wrap">
                <Chip label={selectedTask.trang_thai} color={getStatusColor(selectedTask.trang_thai)} />
                <Chip
                  label={selectedTask.do_uu_tien}
                  color={getPriorityColor(selectedTask.do_uu_tien)}
                  icon={<PriorityHighIcon />}
                />
                <Chip
                  icon={getDifficultyIcon(selectedTask.muc_do_kho || 'Vừa')}
                  label={selectedTask.muc_do_kho || 'Vừa'}
                  color={getDifficultyColor(selectedTask.muc_do_kho || 'Vừa')}
                />
                {isOverdue(selectedTask.ngay_ket_thuc_du_kien) && selectedTask.trang_thai !== 'Hoàn thành' && (
                  <Chip label="Quá hạn" color="error" icon={<WarningIcon />} />
                )}
              </Box>

              <Box mb={3}>
                <Typography variant="body2" gutterBottom>
                  Tiến độ: {selectedTask.tien_do || 0}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={selectedTask.tien_do || 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Typography variant="h6" gutterBottom>
                Mô tả công việc
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedTask.mo_ta || 'Không có mô tả'}
              </Typography>

              <Divider sx={{ my: 3 }} />

              {/* File Attachments Section */}
              <Box sx={{ mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" gutterBottom>
                    Tệp đính kèm
                  </Typography>
                  <input
                    accept="*/*"
                    style={{ display: 'none' }}
                    id="file-upload"
                    multiple
                    type="file"
                    onChange={handleFileSelect}
                  />
                  <label htmlFor="file-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      size="small"
                      disabled={uploadingFiles}
                    >
                      Đính kèm tệp
                    </Button>
                  </label>
                </Box>
                
                {uploadingFiles && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Đang tải lên...
                    </Typography>
                  </Box>
                )}

                {selectedTask.file_dinh_kem && selectedTask.file_dinh_kem.length > 0 ? (
                  <Box>
                    {selectedTask.file_dinh_kem.map((file, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          mb: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          bgcolor: 'background.paper',
                          border: `1px solid ${theme.palette.divider}`,
                          '&:hover': { 
                            bgcolor: 'action.hover',
                            borderColor: 'primary.main'
                          }
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2} flex={1}>
                          <InsertDriveFileIcon color="primary" />
                          <Box flex={1}>
                            <Typography variant="body2" fontWeight="medium">
                              {file.file_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'} • {format(new Date(file.uploaded_at), 'dd/MM/yyyy HH:mm')} • Người tải lên: {getFileUploaderLabel(file, selectedTask)}
                            </Typography>
                          </Box>
                        </Box>
                        <Box display="flex" gap={1}>
                          <Tooltip title="Tải xuống">
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <GetAppIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {file.uploaded_by === user.employee_did && (
                            <Tooltip title="Xóa tệp của bạn">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteFile(selectedTask.task_id, file)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info">
                    Chưa có tệp đính kèm. Nhấn "Đính kèm tệp" để thêm tệp.
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Deadline
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(selectedTask.ngay_ket_thuc_du_kien)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Thời gian deadline trong ngày
                  </Typography>
                  <Typography variant="body1">
                    {formatDeadlineTime(selectedTask.ngay_ket_thuc_du_kien)}
                  </Typography>
                </Grid>
              </Grid>

              {selectedTask.trang_thai === 'Hoàn thành' && (
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: 'background.paper', 
                  borderRadius: 1, 
                  mb: 3,
                  border: `1px solid ${theme.palette.divider}`
                }}>
                  <Typography variant="h6" gutterBottom>
                    Phần thưởng/Phạt
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      {selectedTask.tien_thuong > 0 && (
                        <Chip
                          icon={<TrendingUpIcon />}
                          label={`Thưởng: +${selectedTask.tien_thuong} USDT`}
                          color="success"
                        />
                      )}
                      {selectedTask.tien_phat > 0 && (
                        <Chip
                          icon={<TrendingDownIcon />}
                          label={`Phạt: -${selectedTask.tien_phat} USDT`}
                          color="error"
                        />
                      )}
                    </Box>
                    {selectedTask.payment_transaction_hash && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Giao dịch Blockchain:
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label="Đã chuyển tiền"
                            size="small"
                            color="success"
                            icon={<CheckCircleIcon />}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const explorerUrl = process.env.REACT_APP_BLOCKCHAIN_EXPLORER || 'https://sepolia.etherscan.io';
                              window.open(`${explorerUrl}/tx/${selectedTask.payment_transaction_hash}`, '_blank');
                            }}
                          >
                            {selectedTask.payment_transaction_hash.slice(0, 10)}...{selectedTask.payment_transaction_hash.slice(-8)}
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)} variant="outlined">
            Đóng
          </Button>
          {/* Hiển thị nút cập nhật tiến độ nếu task chưa hoàn thành và chưa bị hủy */}
          {selectedTask && 
           selectedTask.trang_thai !== 'Hoàn thành' && 
           selectedTask.trang_thai !== 'Hủy bỏ' && (
            <Button
              variant="contained"
              onClick={() => {
                handleUpdateProgress(selectedTask);
                setTaskDialogOpen(false);
              }}
            >
              Cập nhật tiến độ
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Progress Update Dialog */}
      <Dialog
        open={progressDialogOpen}
        onClose={() => {
          setProgressDialogOpen(false);
          setProgressNote('');
          setProgressFiles([]);
          setSelectedTask(null);
          setProgressUploading(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`
          } 
        }}
      >
        <DialogTitle sx={{ 
          pb: 2, 
          pt: 3,
          px: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5
        }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme.palette.primary.main + '15',
              color: theme.palette.primary.main
            }}
          >
            <SpeedIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Cập nhật tiến độ công việc
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Theo dõi và cập nhật tiến độ hoàn thành
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 3 }}>
          {/* Task Info Card */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 2, 
              mb: 3, 
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[50],
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <AssignmentIcon 
                sx={{ 
                  color: theme.palette.primary.main,
                  fontSize: 20
                }} 
              />
              <Typography variant="subtitle2" color="text.secondary" fontWeight="medium">
                Công việc:
              </Typography>
            </Box>
            <Typography 
              variant="h6" 
              fontWeight="bold" 
              color="primary"
              sx={{ pl: 4 }}
            >
              {selectedTask?.ten_cong_viec}
            </Typography>
          </Paper>

          {/* Progress Slider Section */}
          <Box sx={{ mb: 4 }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={3}>
              <PlayArrowIcon 
                sx={{ 
                  color: theme.palette.primary.main,
                  fontSize: 24
                }} 
              />
              <Typography variant="h6" fontWeight="bold">
                Chọn tiến độ hiện tại
              </Typography>
            </Box>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Kéo để chọn mức độ hoàn thành công việc
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {progressValue}%
              </Typography>
            </Box>

            <Slider
              value={progressValue}
              min={0}
              max={100}
              step={1}
              valueLabelDisplay="auto"
              onChange={(_, value) => setProgressValue(value)}
              sx={{
                mb: 2,
                '& .MuiSlider-thumb': {
                  width: 18,
                  height: 18
                }
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={progressValue === 100}
                  onChange={(e) => setProgressValue(e.target.checked ? 100 : progressValue)}
                  color="success"
                />
              }
              label="Đánh dấu công việc đã hoàn thành (100%)"
            />

            {/* Progress Bar Visual */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 2.5, 
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[50],
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="body2" color="text.secondary" fontWeight="medium">
                  Tiến độ hiện tại
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">
                  {selectedTask?.tien_do || 0} / 100
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={selectedTask?.tien_do || 0}
                sx={{ 
                  height: 12, 
                  borderRadius: 6,
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? theme.palette.grey[700] 
                    : theme.palette.grey[300],
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    backgroundColor: (selectedTask?.tien_do || 0) === 100 
                      ? theme.palette.success.main
                      : (selectedTask?.tien_do || 0) >= 50 
                      ? theme.palette.primary.main
                      : theme.palette.warning.main,
                  }
                }}
              />
            </Paper>
          </Box>

          {/* Notes Section */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
              Ghi chú về tiến độ
            </Typography>
          <TextField
            fullWidth
            multiline
              rows={4}
              placeholder="Mô tả chi tiết về tiến độ công việc, những gì đã hoàn thành, khó khăn gặp phải..."
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            />
          </Box>

          {/* Progress Files Section */}
          <Box sx={{ mb: 4 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <AttachFileIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Tệp đính kèm (bắt buộc)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Mỗi lần cập nhật tiến độ bạn phải gửi kèm bằng chứng (hình ảnh, tài liệu...). Tối đa 1GB mỗi tệp.
            </Typography>

            <input
              accept="*/*"
              style={{ display: 'none' }}
              id="progress-file-upload"
              multiple
              type="file"
              onChange={handleProgressFileSelect}
            />
            <label htmlFor="progress-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                disabled={progressUploading}
              >
                Chọn tệp đính kèm
              </Button>
            </label>

            {progressFiles.length === 0 ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Chưa chọn tệp. Bạn phải đính kèm ít nhất một tệp để lưu tiến độ.
              </Alert>
            ) : (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {progressFiles.map((file, index) => (
                  <Paper
                    key={`${file.name}-${index}`}
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 2
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar
                        sx={{
                          bgcolor: theme.palette.primary.main,
                          width: 32,
                          height: 32
                        }}
                      >
                        <InsertDriveFileIcon fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeProgressFile(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
              </Box>
            )}
            {progressUploading && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="caption" color="text.secondary">
                  Đang tải lên tệp...
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 3, gap: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button 
            onClick={() => {
              setProgressDialogOpen(false);
              setProgressNote('');
              setProgressFiles([]);
              setSelectedTask(null);
              setProgressUploading(false);
            }} 
            variant="outlined"
            size="large"
            sx={{ minWidth: 120 }}
            disabled={progressUploading}
          >
            Đóng
          </Button>
          <Button
            variant="contained"
            size="large"
            sx={{ minWidth: 140 }}
            onClick={() => handleProgressSubmit(progressValue)}
            disabled={progressUploading}
          >
            Lưu tiến độ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog giải thích cách tính lương và thưởng */}
      <Dialog
        open={rewardInfoDialogOpen}
        onClose={() => setRewardInfoDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <MoneyIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Cách tính lương và thưởng
              </Typography>
            </Box>
            <IconButton onClick={() => setRewardInfoDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box>
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="medium">
                Hệ thống tự động tính toán và thanh toán thưởng dựa trên mức độ khó của công việc và thời gian hoàn thành.
              </Typography>
            </Alert>

            {/* Thưởng cơ bản */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom color="success.main">
                💰 Thưởng cơ bản
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Mỗi công việc hoàn thành sẽ nhận được thưởng cơ bản tùy theo mức độ khó:
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: 'background.paper', border: `2px solid ${theme.palette.success.light}` }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <StarBorderIcon color="success" />
                        <Typography variant="subtitle2" fontWeight="bold" color="success.main">
                          Task Dễ
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight="bold" color="success.main">
                        5 USDT
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: 'background.paper', border: `2px solid ${theme.palette.warning.light}` }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <StarHalfIcon color="warning" />
                        <Typography variant="subtitle2" fontWeight="bold" color="warning.main">
                          Task Vừa
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight="bold" color="warning.main">
                        15 USDT
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: 'background.paper', border: `2px solid ${theme.palette.error.light}` }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <StarIcon color="error" />
                        <Typography variant="subtitle2" fontWeight="bold" color="error.main">
                          Task Khó
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight="bold" color="error.main">
                        20 USDT
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>

            {/* Thưởng thêm khi đúng hạn */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom color="info.main">
                ⏰ Thưởng thêm khi hoàn thành đúng hạn
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Nếu bạn hoàn thành công việc <strong>trước hoặc đúng deadline</strong>, bạn sẽ nhận thêm thưởng:
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="body2" color="text.secondary">Task Dễ</Typography>
                      <Typography variant="h6" fontWeight="bold" color="success.main">
                        +3 USDT
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tổng: <strong>8 USDT</strong>
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="body2" color="text.secondary">Task Vừa</Typography>
                      <Typography variant="h6" fontWeight="bold" color="success.main">
                        +5 USDT
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tổng: <strong>20 USDT</strong>
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="body2" color="text.secondary">Task Khó</Typography>
                      <Typography variant="h6" fontWeight="bold" color="success.main">
                        +8 USDT
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tổng: <strong>28 USDT</strong>
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Paper>

            {/* Phạt khi quá hạn */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom color="error.main">
                ⚠️ Phạt khi quá hạn
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Nếu bạn hoàn thành công việc <strong>sau deadline</strong>, bạn sẽ bị phạt:
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: `2px solid ${theme.palette.error.light}` }}>
                <Typography variant="h5" fontWeight="bold" color="error.main" align="center">
                  -2 USDT
                </Typography>
                <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1 }}>
                  (Áp dụng cho tất cả các mức độ)
                </Typography>
              </Box>
            </Paper>

            {/* Ví dụ */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                📝 Ví dụ cụ thể
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Ví dụ 1: Task Vừa hoàn thành đúng hạn
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Thưởng cơ bản: <strong>15 USDT</strong><br />
                    • Thưởng thêm (đúng hạn): <strong>+5 USDT</strong><br />
                    • <strong style={{ color: theme.palette.success.main }}>Tổng nhận: 20 USDT</strong>
                  </Typography>
                </Box>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Ví dụ 2: Task Khó hoàn thành đúng hạn
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Thưởng cơ bản: <strong>20 USDT</strong><br />
                    • Thưởng thêm (đúng hạn): <strong>+8 USDT</strong><br />
                    • <strong style={{ color: theme.palette.success.main }}>Tổng nhận: 28 USDT</strong>
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: `1px solid ${theme.palette.error.light}` }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="error.main">
                    Ví dụ 3: Task bất kỳ quá hạn
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Thưởng cơ bản: <strong>0 USDT</strong><br />
                    • Phạt (quá hạn): <strong style={{ color: theme.palette.error.main }}>-2 USDT</strong><br />
                    • <strong style={{ color: theme.palette.error.main }}>Tổng: -2 USDT</strong>
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Divider sx={{ my: 3 }} />

            {/* Lưu ý */}
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                ⚠️ Lưu ý quan trọng:
              </Typography>
              <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Thời gian hoàn thành được tính từ khi bạn <strong>submit milestone 100%</strong>, không phải thời gian admin phê duyệt.</li>
                  <li>Nếu admin không phê duyệt trong <strong>1 phút</strong>, hệ thống sẽ tự động phê duyệt và thanh toán.</li>
                  <li>Thanh toán được thực hiện <strong>tự động</strong> vào ví MetaMask của bạn sau khi được phê duyệt.</li>
                  <li>Bạn có thể xem chi tiết thưởng trong mục <strong>"KPI thưởng"</strong>.</li>
                </ul>
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRewardInfoDialogOpen(false)} variant="contained" color="primary">
            Đã hiểu
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
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TaskManagement;
