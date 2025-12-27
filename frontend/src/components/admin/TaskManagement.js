import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, LinearProgress,
  Alert, CircularProgress, Avatar, Tooltip, Paper, Divider,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, InputAdornment,
  Snackbar, Badge, Tabs, Tab, alpha, Skeleton, IconButton, FormControlLabel, Switch, useTheme
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi } from 'date-fns/locale';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as PriorityHighIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Star as StarIcon,
  History as HistoryIcon,
  FileDownload as FileDownloadIcon,
  StarBorder as StarBorderIcon,
  StarHalf as StarHalfIcon,
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
  Event as EventIcon,
  GetApp as GetAppIcon,
  InsertDriveFile as InsertDriveFileIcon,
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteOutlineIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

function AdminTaskManagement({ user, employeeData }) {
  const theme = useTheme();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  // KPI Criteria removed - feature has been deleted
  // const [kpiCriteria, setKpiCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [dateRangeType, setDateRangeType] = useState('all'); // all, today, week, month, year, custom
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [sortBy, setSortBy] = useState('ngay_hoan_thanh_thuc_te'); // Sort completed tasks by completion date
  const [sortOrder, setSortOrder] = useState('desc'); // Newest first

  // Form states for task creation
  const [newTask, setNewTask] = useState({
    ten_cong_viec: '',
    mo_ta: '',
    nguoi_thuc_hien_did: '',
    phong_ban_id: '',
    do_uu_tien: 'Trung bình',
    muc_do_kho: 'Vừa',
    ngay_bat_dau: new Date(),
    ngay_ket_thuc_du_kien: (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    })(),
    // Giao theo phòng ban: ai nhận trước thì làm
    is_department_task: false,
    deadline_time: '17:00', // Thời gian cụ thể deadline trong ngày (mặc định 17:00)
    gio_uoc_tinh: '', // Giữ lại để tương thích với backend
    lien_ket_kpi_id: '',
    tags: []
  });

  // Form states for task editing
  const [editingTask, setEditingTask] = useState(null);
  
  // File upload states for task creation
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
  // File upload states for task editing
  const [editingSelectedFiles, setEditingSelectedFiles] = useState([]);
  const [editingUploadingFiles, setEditingUploadingFiles] = useState(false);
  
  // State để chống spam click khi approve task
  const [approvingTaskId, setApprovingTaskId] = useState(null);

  const getFileUploaderLabel = (file, task) => {
    if (file.uploaded_by === task.nguoi_thuc_hien_did) return 'Nhân viên';
    if (file.uploaded_by === task.nguoi_giao_did) return 'Admin';
    if (file.uploaded_by) return 'Khác';
    return 'Không rõ';
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset filters when switching to "Hoàn thành" tab to ensure tasks are displayed
  useEffect(() => {
    if (activeTab === 3) {
      // Reset status filter when switching to "Hoàn thành" tab
      setFilterStatus('all');
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [tasksRes, employeesRes, departmentsRes] = await Promise.all([
        apiService.getAllTasks(),
        apiService.getAllEmployees(),
        apiService.getAllDepartments()
      ]);

      const tasksData = tasksRes || [];
      setTasks(tasksData);
      setEmployees(employeesRes || []);
      setDepartments(departmentsRes || []);
    } catch (err) {
      console.error('Fetch data error:', err);
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      if (!user || !user.employee_did) {
        setSnackbar({ open: true, message: 'Không thể xác định người dùng.', severity: 'error' });
        return;
      }

      // Yêu cầu phải có ít nhất một tệp đính kèm khi tạo công việc
      if (selectedFiles.length === 0) {
        setSnackbar({
          open: true,
          message: 'Vui lòng đính kèm ít nhất một tệp trước khi tạo công việc.',
          severity: 'warning'
        });
        return;
      }

      setUploadingFiles(true);

      // Upload file trước, lấy metadata
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const uploadResponse = await apiService.uploadMultipleFiles(formData);

      if (!uploadResponse?.success || !uploadResponse.files || uploadResponse.files.length === 0) {
        throw new Error(uploadResponse?.message || 'Không thể tải lên tệp.');
      }

      const initialFiles = uploadResponse.files.map((f) => ({
        ...f,
        uploaded_by: user.employee_did
      }));

      // Kết hợp ngày deadline với thời gian cụ thể
      let deadlineDateTime = null;
      if (newTask.ngay_ket_thuc_du_kien && newTask.deadline_time) {
        const [hours, minutes] = newTask.deadline_time.split(':');
        deadlineDateTime = new Date(newTask.ngay_ket_thuc_du_kien);
        deadlineDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      }

      const taskData = {
        ...newTask,
        nguoi_giao_did: user.employee_did,
        task_id: uuidv4(),
        trang_thai: 'Chờ bắt đầu',
        tien_do: 0,
        // Nếu là task giao cho cả phòng ban thì không gán sẵn người thực hiện
        nguoi_thuc_hien_did: newTask.is_department_task ? null : newTask.nguoi_thuc_hien_did,
        ngay_bat_dau: newTask.ngay_bat_dau ? newTask.ngay_bat_dau.toISOString() : null,
        ngay_ket_thuc_du_kien: deadlineDateTime
          ? deadlineDateTime.toISOString()
          : newTask.ngay_ket_thuc_du_kien
          ? newTask.ngay_ket_thuc_du_kien.toISOString()
          : null,
        deadline_time: newTask.deadline_time || null,
        file_dinh_kem: initialFiles
      };

      const createdTask = await apiService.createTask(taskData);
      const taskId = createdTask?.task_id || taskData.task_id;

      if (!taskId) {
        throw new Error('Không thể lấy task_id sau khi tạo công việc');
      }

      await fetchData();
      setCreateDialogOpen(false);
      resetNewTaskForm();
      setSelectedFiles([]);
      setSnackbar({
        open: true,
        message: `Tạo công việc và đính kèm ${initialFiles.length} tệp thành công!`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Create task error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Không thể tạo công việc.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      // Luôn tắt trạng thái đang upload để không bị kẹt progress bar
      setUploadingFiles(false);
    }
  };

  const handleFileSelect = (event) => {
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

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetNewTaskForm = () => {
    setNewTask({
      ten_cong_viec: '',
      mo_ta: '',
      nguoi_thuc_hien_did: '',
      phong_ban_id: '',
      do_uu_tien: 'Trung bình',
      muc_do_kho: 'Vừa',
      ngay_bat_dau: new Date(),
      ngay_ket_thuc_du_kien: (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      })(),
      is_department_task: false,
      deadline_time: '17:00',
      gio_uoc_tinh: '',
      lien_ket_kpi_id: '',
      tags: []
    });
    setSelectedFiles([]);
    setUploadingFiles(false);
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      // Kết hợp ngày deadline với thời gian cụ thể nếu có
      let updateData = { ...updates };
      if (updates.ngay_ket_thuc_du_kien && updates.deadline_time) {
        const [hours, minutes] = updates.deadline_time.split(':');
        const deadlineDateTime = new Date(updates.ngay_ket_thuc_du_kien);
        deadlineDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        updateData.ngay_ket_thuc_du_kien = deadlineDateTime;
      }
      
      // Convert dates to ISO strings
      if (updateData.ngay_bat_dau instanceof Date) {
        updateData.ngay_bat_dau = updateData.ngay_bat_dau.toISOString();
      }
      if (updateData.ngay_ket_thuc_du_kien instanceof Date) {
        updateData.ngay_ket_thuc_du_kien = updateData.ngay_ket_thuc_du_kien.toISOString();
      }
      
      await apiService.updateTask(taskId, updateData);
      await fetchData();
      setSnackbar({ open: true, message: 'Cập nhật công việc thành công!', severity: 'success' });
      setTaskDialogOpen(false);
      setEditDialogOpen(false);
      setEditingTask(null);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Không thể cập nhật công việc.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleApproveTask = async (taskId, evaluation) => {
    // Chống spam click: nếu đang approve task này hoặc task khác thì return
    if (approvingTaskId !== null) {
      setSnackbar({ 
        open: true, 
        message: 'Đang xử lý phê duyệt, vui lòng đợi...', 
        severity: 'warning' 
      });
      return;
    }

    // Kiểm tra xem task có đang ở trạng thái "Chờ review" không
    const task = tasks.find(t => t.task_id === taskId);
    if (task && task.trang_thai !== 'Chờ review') {
      setSnackbar({ 
        open: true, 
        message: 'Công việc này không ở trạng thái chờ phê duyệt', 
        severity: 'warning' 
      });
      return;
    }

    try {
      setApprovingTaskId(taskId); // Set loading state
      const response = await apiService.approveTask(taskId, evaluation);
      await fetchData();
      
      // Check payment status
      if (response.paymentResult) {
        if (response.paymentResult.success) {
          const txHash = response.paymentResult.transactionHash;
          const txLink = `https://sepolia.etherscan.io/tx/${txHash}`;
          setSnackbar({ 
            open: true, 
            message: `✅ Phê duyệt thành công! Đã chuyển ${response.tien_thuong || 0} USDT vào ví MetaMask của nhân viên. Nhân viên sẽ nhận thông báo trên MetaMask. Xem transaction: ${txHash?.slice(0, 10)}...`, 
            severity: 'success',
            duration: 8000
          });
          
          // Log transaction link for admin
          console.log('Transaction Hash:', txHash);
          console.log('View on Etherscan:', txLink);
        } else if (response.paymentWarning) {
          setSnackbar({ 
            open: true, 
            message: `⚠️ Phê duyệt thành công nhưng chuyển tiền thất bại: ${response.paymentError || 'Vui lòng kiểm tra contract balance'}.`, 
            severity: 'warning',
            duration: 6000
          });
        } else {
          setSnackbar({ 
            open: true, 
            message: 'Phê duyệt công việc thành công!', 
            severity: 'success' 
          });
        }
      } else {
        setSnackbar({ 
          open: true, 
          message: 'Phê duyệt công việc thành công!', 
          severity: 'success' 
        });
      }
      
      setTaskDialogOpen(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Không thể phê duyệt công việc.';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setApprovingTaskId(null); // Reset loading state
    }
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
        await fetchData();
        setSnackbar({ open: true, message: 'Đã xóa công việc thành công!', severity: 'success' });
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Không thể xóa công việc.';
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      }
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const filename = file.file_uri.split('/').pop();
      // Try direct download via URL
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const url = `${apiUrl}/api/tasks/files/${filename}`;
      
      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.file_name);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSnackbar({ 
        open: true, 
        message: `Đang tải xuống: ${file.file_name}`, 
        severity: 'info' 
      });
    } catch (err) {
      setSnackbar({ 
        open: true, 
        message: 'Không thể tải xuống tệp. Vui lòng thử lại.', 
        severity: 'error' 
      });
    }
  };

  // Export completed tasks to CSV
  const handleExportCompletedTasks = () => {
    const completedTasks = tasks.filter(t => t.trang_thai === 'Hoàn thành');
    
    if (completedTasks.length === 0) {
      setSnackbar({ open: true, message: 'Không có công việc đã hoàn thành để xuất.', severity: 'warning' });
      return;
    }

    // Create CSV content
    const headers = ['Tên công việc', 'Người thực hiện', 'Phòng ban', 'Ngày hoàn thành', 'Thưởng (USDT)', 'Phạt (USDT)', 'Transaction Hash', 'Trạng thái thanh toán'];
    const rows = completedTasks.map(task => {
      const employee = employees.find(e => e.employee_did === task.nguoi_thuc_hien_did);
      const department = departments.find(d => d.phong_ban_id === task.phong_ban_id);
      return [
        task.ten_cong_viec || '',
        employee?.ho_ten || task.nguoi_thuc_hien_did || '',
        department?.ten_phong_ban || '',
        task.ngay_hoan_thanh_thuc_te ? format(new Date(task.ngay_hoan_thanh_thuc_te), 'dd/MM/yyyy HH:mm:ss') : '',
        task.tien_thuong || 0,
        task.tien_phat || 0,
        task.payment_transaction_hash || 'Chưa chuyển',
        task.payment_status === 'completed' ? 'Đã chuyển' : task.payment_status === 'failed' ? 'Thất bại' : 'Chưa chuyển'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `danh-sach-cong-viec-hoan-thanh-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSnackbar({ open: true, message: `Đã xuất ${completedTasks.length} công việc đã hoàn thành!`, severity: 'success' });
  };

  const handleEditClick = (task) => {
    setEditingTask({
      ...task,
      ngay_bat_dau: new Date(task.ngay_bat_dau),
      ngay_ket_thuc_du_kien: new Date(task.ngay_ket_thuc_du_kien),
    });
    setEditDialogOpen(true);
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
    if (!task.muc_do_kho) return { reward: 0, penalty: 0 };
    
    const rules = {
      'Dễ': { rewardOnTime: 5, rewardLate: 2.5 },
      'Vừa': { rewardOnTime: 15, rewardLate: 7.5 },
      'Khó': { rewardOnTime: 20, rewardLate: 10 }
    };
    
    const rule = rules[task.muc_do_kho] || rules['Vừa'];
    return {
      reward: task.tien_thuong || 0,
      penalty: task.tien_phat || 0,
      potentialRewardOnTime: rule.rewardOnTime,
      potentialRewardLate: rule.rewardLate
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd/MM/yyyy');
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
    // Đếm task chờ review: chỉ tính những task có status "Chờ review"
    const pendingReview = tasks.filter(t => t.trang_thai === 'Chờ review').length;
    const totalReward = tasks.reduce((sum, t) => sum + (t.tien_thuong || 0), 0);
    const totalPenalty = tasks.reduce((sum, t) => sum + (t.tien_phat || 0), 0);

    return { total, completed, inProgress, overdue, pendingReview, totalReward, totalPenalty };
  }, [tasks]);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    const { rangeStart, rangeEnd } = getDateRange();
    
    let filtered = tasks.filter(task => {
      // Tab filter - ưu tiên cao nhất
      if (activeTab === 1 && task.trang_thai !== 'Đang thực hiện') return false;
      // Tab "Chờ review": chỉ hiển thị các task có status "Chờ review"
      if (activeTab === 2 && task.trang_thai !== 'Chờ review') return false;
      if (activeTab === 3 && task.trang_thai !== 'Hoàn thành') return false;
      if (activeTab === 4 && (!isOverdue(task.ngay_ket_thuc_du_kien) || task.trang_thai === 'Hoàn thành')) return false;
      
      // Date range filter
      if (rangeStart && rangeEnd && task.ngay_ket_thuc_du_kien) {
        const taskDate = new Date(task.ngay_ket_thuc_du_kien);
        if (taskDate < rangeStart || taskDate > rangeEnd) {
          return false;
        }
      }
      
      // Nếu đang ở tab "Hoàn thành", chỉ áp dụng các filter không liên quan đến status
      if (activeTab === 3) {
        // Chỉ filter theo các tiêu chí khác, không filter theo status
        if (filterPriority !== 'all' && task.do_uu_tien !== filterPriority) return false;
        if (filterDepartment !== 'all' && task.phong_ban_id !== filterDepartment) return false;
        if (filterEmployee !== 'all' && task.nguoi_thuc_hien_did !== filterEmployee) return false;
        if (filterDifficulty !== 'all' && task.muc_do_kho !== filterDifficulty) return false;
        if (searchTerm && !task.ten_cong_viec.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      }
      
      // Các filter khác cho các tab khác
      if (filterStatus !== 'all' && task.trang_thai !== filterStatus) return false;
      if (filterPriority !== 'all' && task.do_uu_tien !== filterPriority) return false;
      if (filterDepartment !== 'all' && task.phong_ban_id !== filterDepartment) return false;
      if (filterEmployee !== 'all' && task.nguoi_thuc_hien_did !== filterEmployee) return false;
      if (filterDifficulty !== 'all' && task.muc_do_kho !== filterDifficulty) return false;
      if (searchTerm && !task.ten_cong_viec.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      return true;
    });

    // Sort tasks
    // For completed tasks tab, sort by completion date
    if (activeTab === 3 || (filterStatus === 'Hoàn thành' && activeTab === 0)) {
      filtered.sort((a, b) => {
        const dateA = a.ngay_hoan_thanh_thuc_te ? new Date(a.ngay_hoan_thanh_thuc_te).getTime() : 0;
        const dateB = b.ngay_hoan_thanh_thuc_te ? new Date(b.ngay_hoan_thanh_thuc_te).getTime() : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    } else {
      // For all other tabs, sort by creation date (newest first) - using createdAt or ngay_bat_dau
      filtered.sort((a, b) => {
        // Use createdAt if available (from mongoose timestamps), otherwise use ngay_bat_dau
        const dateA = a.createdAt 
          ? new Date(a.createdAt).getTime() 
          : (a.ngay_bat_dau ? new Date(a.ngay_bat_dau).getTime() : 0);
        const dateB = b.createdAt 
          ? new Date(b.createdAt).getTime() 
          : (b.ngay_bat_dau ? new Date(b.ngay_bat_dau).getTime() : 0);
        return dateB - dateA; // Newest first (descending)
      });
    }

    return filtered;
  }, [tasks, filterStatus, filterPriority, filterDepartment, filterEmployee, filterDifficulty, searchTerm, activeTab, sortBy, sortOrder, getDateRange]);

  const getFilteredEmployees = () => {
    if (!newTask.phong_ban_id) return employees;
    return employees.filter(emp => emp.phong_ban_id === newTask.phong_ban_id);
  };

  const getFilteredEmployeesForEdit = () => {
    if (!editingTask || !editingTask.phong_ban_id) return employees;
    return employees.filter(emp => emp.phong_ban_id === editingTask.phong_ban_id);
  };

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
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
            Quản lý Công việc
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Giao việc, theo dõi tiến độ và quản lý phần thưởng
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            Làm mới
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
              }
            }}
          >
            Tạo công việc
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng công việc</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.total}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <AssignmentIcon sx={{ fontSize: 28 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: 'white',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Đang thực hiện</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.inProgress}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <WorkIcon sx={{ fontSize: 28 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Chờ review</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.pendingReview}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <ScheduleIcon sx={{ fontSize: 28 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Hoàn thành</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.completed}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <CheckCircleIcon sx={{ fontSize: 28 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng thưởng</Typography>
                  <Box display="flex" alignItems="baseline" gap={0.5}>
                    <Typography variant="h3" fontWeight="bold">
                      {stats.totalReward}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                      USDT
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <MoneyIcon sx={{ fontSize: 28 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
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
                  <Chip label={stats.total} size="small" sx={{ ml: 1 }} />
                </Box>
              }
            />
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <WorkIcon fontSize="small" color="primary" />
                  <span>Đang làm</span>
                  <Chip label={stats.inProgress} size="small" color="primary" sx={{ ml: 1 }} />
                </Box>
              }
            />
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon fontSize="small" color="warning" />
                  <span>Chờ review</span>
                  <Chip label={stats.pendingReview} size="small" color="warning" sx={{ ml: 1 }} />
                </Box>
              }
            />
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircleIcon fontSize="small" color="success" />
                  <span>Hoàn thành</span>
                  <Chip label={stats.completed} size="small" color="success" sx={{ ml: 1 }} />
                </Box>
              }
            />
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <PriorityHighIcon fontSize="small" color="error" />
                  <span>Quá hạn</span>
                  <Chip label={stats.overdue} size="small" color="error" sx={{ ml: 1 }} />
                </Box>
              }
            />
          </Tabs>
          {/* Export button for completed tasks */}
          {activeTab === 3 && stats.completed > 0 && (
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCompletedTasks}
              size="small"
              sx={{ ml: 2 }}
            >
              Xuất Excel
            </Button>
          )}
        </Box>
      </Card>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm công việc..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
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
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Trạng thái</InputLabel>
                <Select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} label="Trạng thái">
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="Chờ bắt đầu">Chờ bắt đầu</MenuItem>
                  <MenuItem value="Đang thực hiện">Đang thực hiện</MenuItem>
                  <MenuItem value="Chờ review">Chờ review</MenuItem>
                  <MenuItem value="Hoàn thành">Hoàn thành</MenuItem>
                  <MenuItem value="Tạm dừng">Tạm dừng</MenuItem>
                  <MenuItem value="Hủy bỏ">Hủy bỏ</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
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
            <Grid item xs={12} md={2}>
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
            <Grid item xs={12} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Phòng ban</InputLabel>
                <Select value={filterDepartment} onChange={(e) => { setFilterDepartment(e.target.value); setPage(0); }} label="Phòng ban">
                  <MenuItem value="all">Tất cả</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept.phong_ban_id} value={dept.phong_ban_id}>
                      {dept.ten_phong_ban}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Nhân viên</InputLabel>
                <Select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); setPage(0); }} label="Nhân viên">
                  <MenuItem value="all">Tất cả</MenuItem>
                  {employees.map((emp) => (
                    <MenuItem key={emp.employee_did} value={emp.employee_did}>
                      {emp.ho_ten || emp.employee_did}
                    </MenuItem>
                  ))}
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
            {/* Sort options for completed tasks */}
            {activeTab === 3 && (
              <Grid item xs={12} md={1}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sắp xếp</InputLabel>
                  <Select 
                    value={sortOrder} 
                    onChange={(e) => { setSortOrder(e.target.value); setPage(0); }} 
                    label="Sắp xếp"
                  >
                    <MenuItem value="desc">Mới nhất</MenuItem>
                    <MenuItem value="asc">Cũ nhất</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Công việc</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Người thực hiện</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phòng ban</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Mức độ</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Deadline</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tiến độ</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Thưởng/Phạt</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <AssignmentIcon sx={{ fontSize: 64, color: 'grey.300' }} />
                      <Typography variant="h6" color="text.secondary">
                        Không tìm thấy công việc
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
                          <Typography variant="body2" fontWeight={600}>
                            {task.ten_cong_viec}
                          </Typography>
                          {task.mo_ta && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                              {task.mo_ta}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                            {(task.nguoi_thuc_hien_did || 'N')[0]}
                          </Avatar>
                          <Typography variant="body2">
                            {task.is_department_task && !task.nguoi_thuc_hien_did
                              ? 'Chưa có người nhận (task phòng ban)'
                              : (employees.find(e => e.employee_did === task.nguoi_thuc_hien_did)?.ho_ten || task.nguoi_thuc_hien_did)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {departments.find(d => d.phong_ban_id === task.phong_ban_id)?.ten_phong_ban || 'N/A'}
                        </Typography>
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
                        {task.trang_thai === 'Hoàn thành' && task.ngay_hoan_thanh_thuc_te && (
                          <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                            Hoàn thành: {format(new Date(task.ngay_hoan_thanh_thuc_te), 'dd/MM/yyyy')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={task.tien_do || 0}
                            sx={{ flexGrow: 1, maxWidth: 80, height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {task.tien_do || 0}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {task.trang_thai === 'Hoàn thành' ? (
                          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                            {rewardInfo.reward > 0 && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Chip
                                  icon={<TrendingUpIcon />}
                                  label={`+${rewardInfo.reward} USDT`}
                                  size="small"
                                  color="success"
                                  sx={{ fontWeight: 600 }}
                                />
                                {task.payment_transaction_hash && (
                                  <Tooltip title="Đã chuyển vào ví MetaMask">
                                    <CheckCircleIcon fontSize="small" color="success" />
                                  </Tooltip>
                                )}
                              </Box>
                            )}
                            {rewardInfo.penalty > 0 && (
                              <Chip
                                icon={<TrendingDownIcon />}
                                label={`-${rewardInfo.penalty} USDT`}
                                size="small"
                                color="error"
                                sx={{ fontWeight: 600 }}
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
                              onClick={() => {
                                setSelectedTask(task);
                                setTaskDialogOpen(true);
                              }}
                            >
                              <AssignmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Chỉnh sửa">
                            <IconButton size="small" onClick={() => handleEditClick(task)} color="primary">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {task.trang_thai === 'Chờ review' && (
                            <Tooltip title={approvingTaskId === task.task_id ? "Đang xử lý..." : "Phê duyệt"}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  disabled={approvingTaskId !== null}
                                  onClick={() => handleApproveTask(task.task_id, {})}
                                >
                                  {approvingTaskId === task.task_id ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <CheckCircleIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {/* Nút xóa - hiển thị cho tất cả tasks, kể cả đã hoàn thành */}
                          {(task.trang_thai !== 'Đang thực hiện' && task.trang_thai !== 'Chờ review') && (
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

      {/* Create Task Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon color="primary" />
          Tạo công việc mới
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tên công việc"
                value={newTask.ten_cong_viec}
                onChange={(e) => setNewTask({...newTask, ten_cong_viec: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Mô tả"
                value={newTask.mo_ta}
                onChange={(e) => setNewTask({...newTask, mo_ta: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Phòng ban</InputLabel>
                <Select
                  value={newTask.phong_ban_id}
                  label="Phòng ban"
                  onChange={(e) => setNewTask({
                    ...newTask,
                    phong_ban_id: e.target.value,
                    // Khi đổi phòng ban thì reset người thực hiện
                    nguoi_thuc_hien_did: ''
                  })}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept.phong_ban_id} value={dept.phong_ban_id}>
                      {dept.ten_phong_ban}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" flexDirection="column" gap={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newTask.is_department_task}
                      onChange={(e) => setNewTask({
                        ...newTask,
                        is_department_task: e.target.checked,
                        // Nếu chuyển sang giao cho cả phòng ban thì bỏ chọn người thực hiện
                        nguoi_thuc_hien_did: e.target.checked ? '' : newTask.nguoi_thuc_hien_did
                      })}
                      color="primary"
                    />
                  }
                  label="Giao cho cả phòng ban (ai nhận trước thì làm)"
                />
                {!newTask.is_department_task && (
              <FormControl fullWidth required>
                <InputLabel>Người thực hiện</InputLabel>
                <Select
                  value={newTask.nguoi_thuc_hien_did}
                  label="Người thực hiện"
                  onChange={(e) => setNewTask({...newTask, nguoi_thuc_hien_did: e.target.value})}
                  disabled={!newTask.phong_ban_id}
                >
                  {getFilteredEmployees().map((emp) => (
                    <MenuItem key={emp.employee_did} value={emp.employee_did}>
                      {emp.ho_ten || emp.employee_did}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Độ ưu tiên</InputLabel>
                <Select
                  value={newTask.do_uu_tien}
                  label="Độ ưu tiên"
                  onChange={(e) => setNewTask({...newTask, do_uu_tien: e.target.value})}
                >
                  <MenuItem value="Thấp">Thấp</MenuItem>
                  <MenuItem value="Trung bình">Trung bình</MenuItem>
                  <MenuItem value="Cao">Cao</MenuItem>
                  <MenuItem value="Khẩn cấp">Khẩn cấp</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Mức độ khó</InputLabel>
                <Select
                  value={newTask.muc_do_kho}
                  label="Mức độ khó"
                  onChange={(e) => setNewTask({...newTask, muc_do_kho: e.target.value})}
                >
                  <MenuItem value="Dễ">
                    <Box display="flex" alignItems="center" gap={1}>
                      <StarBorderIcon fontSize="small" />
                      <span>Dễ (+5 USDT đúng hạn / +2.5 USDT quá hạn)</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="Vừa">
                    <Box display="flex" alignItems="center" gap={1}>
                      <StarHalfIcon fontSize="small" />
                      <span>Vừa (+15 USDT đúng hạn / +7.5 USDT quá hạn)</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="Khó">
                    <Box display="flex" alignItems="center" gap={1}>
                      <StarIcon fontSize="small" />
                      <span>Khó (+20 USDT đúng hạn / +10 USDT quá hạn)</span>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Ngày bắt đầu"
                value={newTask.ngay_bat_dau.toISOString().split('T')[0]}
                onChange={(e) => setNewTask({...newTask, ngay_bat_dau: new Date(e.target.value)})}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayIcon color="primary" />
                    </InputAdornment>
                  ),
                }}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Ngày deadline"
                value={newTask.ngay_ket_thuc_du_kien.toISOString().split('T')[0]}
                onChange={(e) => setNewTask({...newTask, ngay_ket_thuc_du_kien: new Date(e.target.value)})}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EventIcon color="error" />
                    </InputAdornment>
                  ),
                }}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'error.main',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="time"
                label="Thời gian deadline trong ngày"
                value={newTask.deadline_time}
                onChange={(e) => setNewTask({...newTask, deadline_time: e.target.value})}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccessTimeIcon color="warning" />
                    </InputAdornment>
                  ),
                }}
                helperText="Thời gian cụ thể cần hoàn thành trong ngày"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'warning.main',
                    },
                  },
                }}
              />
            </Grid>
            
            {/* File Upload Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AttachFileIcon color="primary" />
                  Tệp đính kèm (tùy chọn)
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <input
                    accept="*/*"
                    style={{ display: 'none' }}
                    id="file-upload-create"
                    multiple
                    type="file"
                    onChange={handleFileSelect}
                  />
                  <label htmlFor="file-upload-create">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      size="small"
                      disabled={uploadingFiles}
                      sx={{ mb: 2 }}
                    >
                      Chọn tệp đính kèm
                    </Button>
                  </label>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Có thể chọn nhiều tệp, mỗi tệp tối đa 1GB
                  </Typography>
                </Box>
                
                {uploadingFiles && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Đang tải lên tệp...
                    </Typography>
                  </Box>
                )}
                
                {selectedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Đã chọn {selectedFiles.length} tệp:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                      {selectedFiles.map((file, index) => (
                        <Paper
                          key={index}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1.5,
                            bgcolor: 'background.paper',
                            '&:hover': {
                              bgcolor: 'action.hover',
                            }
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                            <Avatar
                              sx={{
                                bgcolor: 'primary.main',
                                width: 32,
                                height: 32
                              }}
                            >
                              <InsertDriveFileIcon fontSize="small" />
                            </Avatar>
                            <Box flex={1}>
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
                            onClick={() => handleRemoveFile(index)}
                            color="error"
                            sx={{
                              '&:hover': {
                                bgcolor: 'error.main',
                                color: 'white'
                              }
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCreateDialogOpen(false)} variant="outlined">
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTask}
            disabled={
              !newTask.ten_cong_viec ||
              !newTask.phong_ban_id ||
            (!newTask.is_department_task && !newTask.nguoi_thuc_hien_did) ||
            selectedFiles.length === 0 ||
            uploadingFiles
            }
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
              }
            }}
          >
            Tạo công việc
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Task Dialog */}
      {editingTask && (
        <Dialog
          open={editDialogOpen}
          onClose={() => { setEditDialogOpen(false); setEditingTask(null); }}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ pb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon color="primary" />
            Chỉnh sửa công việc
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tên công việc"
                  value={editingTask.ten_cong_viec}
                  onChange={(e) => setEditingTask({ ...editingTask, ten_cong_viec: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Mô tả"
                  value={editingTask.mo_ta}
                  onChange={(e) => setEditingTask({ ...editingTask, mo_ta: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Phòng ban</InputLabel>
                  <Select
                    value={editingTask.phong_ban_id}
                    label="Phòng ban"
                    onChange={(e) => setEditingTask({ ...editingTask, phong_ban_id: e.target.value, nguoi_thuc_hien_did: '' })}
                  >
                    {departments.map((dept) => (
                      <MenuItem key={dept.phong_ban_id} value={dept.phong_ban_id}>
                        {dept.ten_phong_ban}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Người thực hiện</InputLabel>
                  <Select
                    value={editingTask.nguoi_thuc_hien_did}
                    label="Người thực hiện"
                    onChange={(e) => setEditingTask({ ...editingTask, nguoi_thuc_hien_did: e.target.value })}
                    disabled={!editingTask.phong_ban_id}
                  >
                    {getFilteredEmployeesForEdit().map((emp) => (
                      <MenuItem key={emp.employee_did} value={emp.employee_did}>
                        {emp.ho_ten || emp.employee_did}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Độ ưu tiên</InputLabel>
                  <Select
                    value={editingTask.do_uu_tien}
                    label="Độ ưu tiên"
                    onChange={(e) => setEditingTask({ ...editingTask, do_uu_tien: e.target.value })}
                  >
                    <MenuItem value="Thấp">Thấp</MenuItem>
                    <MenuItem value="Trung bình">Trung bình</MenuItem>
                    <MenuItem value="Cao">Cao</MenuItem>
                    <MenuItem value="Khẩn cấp">Khẩn cấp</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Mức độ khó</InputLabel>
                  <Select
                    value={editingTask.muc_do_kho || 'Vừa'}
                    label="Mức độ khó"
                    onChange={(e) => setEditingTask({ ...editingTask, muc_do_kho: e.target.value })}
                  >
                    <MenuItem value="Dễ">Dễ (+5 USDT đúng hạn / +2.5 USDT quá hạn)</MenuItem>
                    <MenuItem value="Vừa">Vừa (+15 USDT đúng hạn / +7.5 USDT quá hạn)</MenuItem>
                    <MenuItem value="Khó">Khó (+20 USDT đúng hạn / +10 USDT quá hạn)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Trạng thái</InputLabel>
                  <Select
                    value={editingTask.trang_thai}
                    label="Trạng thái"
                    onChange={(e) => setEditingTask({ ...editingTask, trang_thai: e.target.value })}
                  >
                    <MenuItem value="Chờ bắt đầu">Chờ bắt đầu</MenuItem>
                    <MenuItem value="Đang thực hiện">Đang thực hiện</MenuItem>
                    <MenuItem value="Chờ review">Chờ review</MenuItem>
                    <MenuItem value="Hoàn thành">Hoàn thành</MenuItem>
                    <MenuItem value="Tạm dừng">Tạm dừng</MenuItem>
                    <MenuItem value="Hủy bỏ">Hủy bỏ</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày bắt đầu"
                  value={editingTask.ngay_bat_dau.toISOString().split('T')[0]}
                  onChange={(e) => setEditingTask({ ...editingTask, ngay_bat_dau: new Date(e.target.value) })}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarTodayIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày deadline"
                  value={editingTask.ngay_ket_thuc_du_kien.toISOString().split('T')[0]}
                  onChange={(e) => setEditingTask({ ...editingTask, ngay_ket_thuc_du_kien: new Date(e.target.value) })}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EventIcon color="error" />
                      </InputAdornment>
                    ),
                  }}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'error.main',
                      },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="time"
                  label="Thời gian deadline trong ngày"
                  value={editingTask.deadline_time || (editingTask.ngay_ket_thuc_du_kien ? 
                    `${String(editingTask.ngay_ket_thuc_du_kien.getHours()).padStart(2, '0')}:${String(editingTask.ngay_ket_thuc_du_kien.getMinutes()).padStart(2, '0')}` : '17:00')}
                  onChange={(e) => setEditingTask({ ...editingTask, deadline_time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccessTimeIcon color="warning" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Thời gian cụ thể cần hoàn thành trong ngày"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'warning.main',
                      },
                    },
                  }}
                />
              </Grid>
              
              {/* File Attachments Section for Edit */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AttachFileIcon color="primary" />
                    Tệp đính kèm
                    {editingTask.file_dinh_kem && editingTask.file_dinh_kem.length > 0 && (
                      <Chip 
                        label={editingTask.file_dinh_kem.length} 
                        size="small" 
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  
                  {/* Display existing files */}
                  {editingTask.file_dinh_kem && editingTask.file_dinh_kem.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Tệp đã đính kèm:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {editingTask.file_dinh_kem.map((file, index) => (
                          <Paper
                            key={index}
                            elevation={0}
                            sx={{
                              p: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1.5,
                              bgcolor: 'background.paper',
                              '&:hover': {
                                bgcolor: 'action.hover',
                                borderColor: 'primary.main'
                              }
                            }}
                          >
                            <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                              <Avatar
                                sx={{
                                  bgcolor: 'primary.main',
                                  width: 32,
                                  height: 32
                                }}
                              >
                                <InsertDriveFileIcon fontSize="small" />
                              </Avatar>
                              <Box flex={1}>
                                <Typography variant="body2" fontWeight="medium">
                                  {file.file_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                                  {file.uploaded_at && ` • ${format(new Date(file.uploaded_at), 'dd/MM/yyyy HH:mm')}`}
                                  {` • Người tải lên: ${getFileUploaderLabel(file, editingTask)}`}
                                </Typography>
                              </Box>
                            </Box>
                            <Tooltip title="Tải xuống">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleDownloadFile(file)}
                                sx={{
                                  '&:hover': {
                                    bgcolor: 'primary.main',
                                    color: 'white'
                                  }
                                }}
                              >
                                <GetAppIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                  
                  {/* Upload new files */}
                  <Box sx={{ mb: 2 }}>
                    <input
                      accept="*/*"
                      style={{ display: 'none' }}
                      id="file-upload-edit"
                      multiple
                      type="file"
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
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

                        setEditingSelectedFiles(prev => [...prev, ...files]);
                      }}
                    />
                    <label htmlFor="file-upload-edit">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<CloudUploadIcon />}
                        size="small"
                        disabled={editingUploadingFiles}
                        sx={{ mb: 1 }}
                      >
                        Thêm tệp đính kèm
                      </Button>
                    </label>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      Có thể chọn nhiều tệp, mỗi tệp tối đa 1GB
                    </Typography>
                  </Box>
                  
                  {editingUploadingFiles && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Đang tải lên tệp...
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Display newly selected files */}
                  {editingSelectedFiles.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Tệp mới sẽ được thêm ({editingSelectedFiles.length}):
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {editingSelectedFiles.map((file, index) => (
                          <Paper
                            key={index}
                            elevation={0}
                            sx={{
                              p: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1.5,
                              bgcolor: 'background.paper',
                              '&:hover': {
                                bgcolor: 'action.hover',
                              }
                            }}
                          >
                            <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                              <Avatar
                                sx={{
                                  bgcolor: 'success.main',
                                  width: 32,
                                  height: 32
                                }}
                              >
                                <InsertDriveFileIcon fontSize="small" />
                              </Avatar>
                              <Box flex={1}>
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
                              onClick={() => setEditingSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                              color="error"
                              sx={{
                                '&:hover': {
                                  bgcolor: 'error.main',
                                  color: 'white'
                                }
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { 
              setEditDialogOpen(false); 
              setEditingTask(null);
              setEditingSelectedFiles([]);
            }} variant="outlined">
              Hủy
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                // First update task
                await handleUpdateTask(editingTask.task_id, editingTask);
                
                // Then upload new files if any
                if (editingSelectedFiles.length > 0) {
                  setEditingUploadingFiles(true);
                  try {
                    const formData = new FormData();
                    editingSelectedFiles.forEach((file) => {
                      formData.append('files', file);
                    });

                    const uploadResponse = await apiService.uploadMultipleFiles(formData);
                    
                    if (uploadResponse.success && uploadResponse.files) {
                      // Attach files to the task
                      await apiService.attachFileToTask(editingTask.task_id, { 
                        files: uploadResponse.files.map(f => ({
                          ...f,
                          uploaded_by: user.employee_did
                        }))
                      });
                      setSnackbar({ 
                        open: true, 
                        message: `Đã thêm ${uploadResponse.files.length} tệp đính kèm!`, 
                        severity: 'success' 
                      });
                    }
                  } catch (uploadErr) {
                    console.error('File upload error:', uploadErr);
                    setSnackbar({ 
                      open: true, 
                      message: 'Cập nhật công việc thành công nhưng thêm tệp thất bại.', 
                      severity: 'warning' 
                    });
                  } finally {
                    setEditingUploadingFiles(false);
                    setEditingSelectedFiles([]);
                  }
                }
              }}
              disabled={!editingTask.ten_cong_viec || !editingTask.nguoi_thuc_hien_did || editingUploadingFiles}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                }
              }}
            >
              Lưu thay đổi
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Task Detail Dialog */}
      <Dialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon color="primary" />
          {selectedTask?.ten_cong_viec}
        </DialogTitle>
        <Divider />
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
                  <Chip label="Quá hạn" color="error" icon={<PriorityHighIcon />} />
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

              {selectedTask.trang_thai === 'Chờ review' && (
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                  Nhân viên đã cập nhật tiến độ lên <strong>{selectedTask.tien_do || 0}%</strong> và gửi{' '}
                  <strong>{selectedTask.file_dinh_kem?.length || 0}</strong> tệp đính kèm. Vui lòng kiểm tra kỹ trước khi phê duyệt.
                </Alert>
              )}

              <Typography variant="h6" gutterBottom>
                Mô tả công việc
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedTask.mo_ta || 'Không có mô tả'}
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Người thực hiện
                  </Typography>
                  <Typography variant="body1">
                    {employees.find(e => e.employee_did === selectedTask.nguoi_thuc_hien_did)?.ho_ten || selectedTask.nguoi_thuc_hien_did}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Phòng ban
                  </Typography>
                  <Typography variant="body1">
                    {departments.find(d => d.phong_ban_id === selectedTask.phong_ban_id)?.ten_phong_ban || 'N/A'}
                  </Typography>
                </Grid>
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
                    {selectedTask.deadline_time || (selectedTask.ngay_ket_thuc_du_kien ? 
                      `${String(new Date(selectedTask.ngay_ket_thuc_du_kien).getHours()).padStart(2, '0')}:${String(new Date(selectedTask.ngay_ket_thuc_du_kien).getMinutes()).padStart(2, '0')}` : 'N/A')}
                  </Typography>
                </Grid>
              </Grid>

              {/* File Attachments Section - Always visible */}
              <Divider sx={{ my: 3 }} />
              <Box sx={{ mt: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AttachFileIcon color="primary" />
                  Tệp đính kèm
                  {selectedTask.file_dinh_kem && selectedTask.file_dinh_kem.length > 0 && (
                    <Chip 
                      label={selectedTask.file_dinh_kem.length} 
                      size="small" 
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
                
                {selectedTask.file_dinh_kem && selectedTask.file_dinh_kem.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    {selectedTask.file_dinh_kem.map((file, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                          transition: 'all 0.2s',
                          '&:hover': { 
                            bgcolor: 'action.hover',
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)',
                            boxShadow: 2
                          }
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2} flex={1}>
                          <Avatar
                            sx={{
                              bgcolor: 'primary.main',
                              width: 48,
                              height: 48
                            }}
                          >
                            <InsertDriveFileIcon />
                          </Avatar>
                          <Box flex={1}>
                            <Typography variant="body2" fontWeight="medium" gutterBottom>
                              {file.file_name}
                            </Typography>
                            <Box display="flex" gap={2} flexWrap="wrap">
                              <Typography variant="caption" color="text.secondary">
                                {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                              </Typography>
                              {file.uploaded_at && (
                                <Typography variant="caption" color="text.secondary">
                                  {format(new Date(file.uploaded_at), 'dd/MM/yyyy HH:mm')}
                                </Typography>
                              )}
                              <Typography variant="caption" color="primary.main">
                                Người tải lên: {getFileUploaderLabel(file, selectedTask)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Tooltip title="Tải xuống tệp">
                          <IconButton
                            color="primary"
                            onClick={() => handleDownloadFile(file)}
                            sx={{
                              '&:hover': {
                                bgcolor: 'primary.main',
                                color: 'white',
                                transform: 'scale(1.1)'
                              },
                              transition: 'all 0.2s'
                            }}
                          >
                            <GetAppIcon />
                          </IconButton>
                        </Tooltip>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Alert 
                    severity="info" 
                    icon={<AttachFileIcon />}
                    sx={{ 
                      mt: 2,
                      borderRadius: 2
                    }}
                  >
                    Chưa có tệp đính kèm. Nhân viên có thể đính kèm tệp khi cập nhật tiến độ công việc.
                  </Alert>
                )}
              </Box>

              {selectedTask.trang_thai === 'Hoàn thành' && (
                <Paper sx={{ p: 2, bgcolor: alpha('#4caf50', 0.1), borderRadius: 2, mb: 3 }}>
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
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {selectedTask.tien_phat > 0 && (
                        <Chip
                          icon={<TrendingDownIcon />}
                          label={`Phạt: -${selectedTask.tien_phat} USDT`}
                          color="error"
                          sx={{ fontWeight: 600 }}
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
                            color="success"
                            size="small"
                            icon={<CheckCircleIcon />}
                          />
                          <Tooltip title="Xem trên blockchain explorer">
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
                          </Tooltip>
                        </Box>
                        {selectedTask.payment_timestamp && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Thời gian: {format(new Date(selectedTask.payment_timestamp), 'dd/MM/yyyy HH:mm:ss')}
                          </Typography>
                        )}
                      </Box>
                    )}
                    {selectedTask.tien_thuong > 0 && !selectedTask.payment_transaction_hash && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        Tiền thưởng đang được xử lý chuyển vào ví MetaMask...
                      </Alert>
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setTaskDialogOpen(false)} variant="outlined">
            Đóng
          </Button>
          {selectedTask?.trang_thai === 'Chờ review' && (
            <Button
              variant="contained"
              color="success"
              disabled={approvingTaskId !== null}
              onClick={async () => {
                await handleApproveTask(selectedTask.task_id, {});
                setTaskDialogOpen(false);
              }}
              startIcon={approvingTaskId === selectedTask.task_id ? <CircularProgress size={16} /> : null}
            >
              {approvingTaskId === selectedTask.task_id ? 'Đang xử lý...' : 'Phê duyệt'}
            </Button>
          )}
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
  );
}

export default AdminTaskManagement;
