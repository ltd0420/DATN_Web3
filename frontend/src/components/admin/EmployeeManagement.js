import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Tooltip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Avatar, Alert, Snackbar, FormControl, InputLabel, Select, MenuItem,
  InputAdornment, TablePagination, LinearProgress, Skeleton, Divider,
  Badge, Tabs, Tab, alpha, Collapse, Stack, CardActions, Fade, Zoom,
  Menu, ListItemIcon, ListItemText, useTheme, useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Group as GroupIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as ManagerIcon,
  PersonOutline as EmployeeIcon,
  Verified as VerifiedIcon,
  Close as CloseIcon,
  Chat as ChatIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { vi } from 'date-fns/locale';
import { format } from 'date-fns';
import { ethers } from 'ethers';
import apiService from '../../services/apiService';
import authService from '../../services/authService';

const EmployeeManagement = ({ user, employeeData, onNavigateToChat }) => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [canCreateEmployee, setCanCreateEmployee] = useState(false);
  const [formData, setFormData] = useState({
    employee_did: '',
    ho_ten: '',
    email: '',
    so_dien_thoai: '',
    chuc_vu: '',
    phong_ban_id: '',
    trang_thai: 'Đang làm việc',
    ngay_vao_lam: null,
    walletAddress: '',
    role_id: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [currentUser, setCurrentUser] = useState(null);
  const [walletStatus, setWalletStatus] = useState({ type: 'idle', message: '' });
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchUserRoleAndDepartment();
    fetchEmployees();
    fetchDepartments();
    fetchRoles();
  }, []);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.trang_thai === 'Đang làm việc').length;
    const onLeave = employees.filter(e => e.trang_thai === 'Nghỉ phép' || e.trang_thai === 'Tạm nghỉ').length;
    const resigned = employees.filter(e => e.trang_thai === 'Đã nghỉ việc').length;
    const verified = employees.filter(e => e.wallet_verified).length;

    return { total, active, onLeave, resigned, verified };
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = employee.ho_ten?.toLowerCase().includes(query);
        const matchDid = employee.employee_did?.toLowerCase().includes(query);
        const matchEmail = employee.email?.toLowerCase().includes(query);
        const matchWallet = employee.walletAddress?.toLowerCase().includes(query);
        if (!matchName && !matchDid && !matchEmail && !matchWallet) return false;
      }

      // Department filter
      if (filterDepartment !== 'all' && employee.phong_ban_id !== filterDepartment) return false;

      // Role filter
      if (filterRole !== 'all' && employee.role_id !== filterRole) return false;

      // Status filter
      if (filterStatus !== 'all' && employee.trang_thai !== filterStatus) return false;

      // Tab filter
      if (activeTab === 1 && employee.trang_thai !== 'Đang làm việc') return false;
      if (activeTab === 2 && employee.trang_thai !== 'Nghỉ phép' && employee.trang_thai !== 'Tạm nghỉ') return false;
      if (activeTab === 3 && employee.trang_thai !== 'Đã nghỉ việc') return false;

      return true;
    });
  }, [employees, searchQuery, filterDepartment, filterRole, filterStatus, activeTab]);

  const isValidEthereumAddress = (address) => {
    if (!address) return false;
    try {
      return ethers.isAddress(address.trim());
    } catch (error) {
      return false;
    }
  };

  const handleWalletInputChange = (wallet) => {
    const cleanedValue = wallet.trim();
    setFormData((prev) => ({ ...prev, walletAddress: cleanedValue }));

    if (!cleanedValue) {
      setWalletStatus({ type: 'error', message: 'Địa chỉ ví là bắt buộc.' });
      return;
    }

    if (!isValidEthereumAddress(cleanedValue)) {
      setWalletStatus({ type: 'error', message: 'Địa chỉ ví không hợp lệ. Định dạng: 0x + 40 ký tự hex.' });
      return;
    }

    setWalletStatus({
      type: 'format-ok',
      message: 'Định dạng hợp lệ. Nhấn "Kiểm tra trùng" để xác nhận.'
    });
  };

  const checkWalletAvailability = async (address) => {
    if (!address || !isValidEthereumAddress(address)) {
      setWalletStatus({ type: 'error', message: 'Vui lòng nhập địa chỉ ví Ethereum hợp lệ.' });
      return;
    }

    setCheckingWallet(true);
    try {
      const normalized = ethers.getAddress(address.trim());
      const existingEmployee = await apiService.getEmployeeByWallet(normalized);

      if (editingEmployee && existingEmployee.employee_did === editingEmployee.employee_did) {
        setWalletStatus({ type: 'success', message: 'Địa chỉ ví hiện đang gán cho nhân viên này.' });
      } else {
        setWalletStatus({ type: 'error', message: 'Địa chỉ ví đã được sử dụng.' });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setWalletStatus({ type: 'success', message: 'Địa chỉ ví hợp lệ và chưa được sử dụng.' });
      } else {
        setWalletStatus({ type: 'error', message: 'Không thể kiểm tra. Vui lòng thử lại.' });
      }
    } finally {
      setCheckingWallet(false);
    }
  };

  const handleConnectWallet = async () => {
    if (!authService.isMetaMaskInstalled()) {
      setSnackbar({ open: true, message: 'Vui lòng cài đặt MetaMask.', severity: 'warning' });
      return;
    }

    setConnectingWallet(true);
    try {
      await authService.initializeProvider();
      const wallet = await authService.getWalletAddress();
      handleWalletInputChange(wallet);
      await checkWalletAvailability(wallet);
    } catch (error) {
      setSnackbar({ open: true, message: 'Không thể kết nối MetaMask.', severity: 'error' });
    } finally {
      setConnectingWallet(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllEmployees();
      setEmployees(response || []);
    } catch (error) {
      setSnackbar({ open: true, message: 'Lỗi khi tải danh sách nhân viên', severity: 'error' });
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await apiService.getDepartments();
      setDepartments(response || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiService.get('/roles');
      const rolesData = response.data?.roles || [];
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (error) {
      setRoles([]);
    }
  };

  const fetchUserRoleAndDepartment = async () => {
    try {
      if (!currentUser) {
        let basicUser = authService.getCurrentUser();
        if (!basicUser) {
          basicUser = await authService.getProfile();
        }
        if (basicUser?.did) {
          const fullUserProfile = await apiService.get(`/employees/${basicUser.did}`);
          setCurrentUser(fullUserProfile?.data || fullUserProfile);
        }
      }

      const permissionsResponse = await apiService.get('/roles/permissions/me');
      const userPermissions = permissionsResponse.data?.permissions;

      let role = 'Employee';
      let canCreate = false;

      if (userPermissions?.system_settings?.manage_roles) {
        role = 'Super Admin';
        canCreate = true;
      } else if (userPermissions?.ho_so_nhan_vien?.view_all) {
        role = 'Manager';
        canCreate = true;
      }

      setUserRole(role);
      setCanCreateEmployee(canCreate);
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const handleOpenDialog = (employee) => {
    if (!employee) {
      setSnackbar({ open: true, message: 'Chức năng thêm nhân viên đã bị vô hiệu hóa.', severity: 'warning' });
      return;
    }

    setEditingEmployee(employee);
    setFormData({
      ...employee,
      ngay_vao_lam: employee.ngay_vao_lam ? new Date(employee.ngay_vao_lam) : null,
      role_id: employee.role_id || '',
    });
    setWalletStatus({ type: 'success', message: 'Địa chỉ ví hiện tại.' });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
    setWalletStatus({ type: 'idle', message: '' });
  };

  const handleSaveEmployee = async () => {
    try {
      if (!editingEmployee) {
        setSnackbar({ open: true, message: 'Chức năng thêm nhân viên đã bị vô hiệu hóa.', severity: 'warning' });
        return;
      }

      const normalizedWallet = formData.walletAddress?.trim();
      if (!normalizedWallet || !isValidEthereumAddress(normalizedWallet)) {
        setSnackbar({ open: true, message: 'Địa chỉ ví không hợp lệ.', severity: 'error' });
        return;
      }

      const originalWallet = editingEmployee.walletAddress?.toLowerCase() || null;
      const walletChanged = normalizedWallet.toLowerCase() !== originalWallet;
      
      if (walletChanged && walletStatus.type !== 'success') {
        setSnackbar({ open: true, message: 'Vui lòng kiểm tra địa chỉ ví trước khi lưu.', severity: 'warning' });
        return;
      }

      // Validate required fields
      if (!formData.chuc_vu || !formData.phong_ban_id) {
        setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin bắt buộc.', severity: 'error' });
        return;
      }

      const updateData = {
        chuc_vu: formData.chuc_vu,
        phong_ban_id: formData.phong_ban_id,
        trang_thai: formData.trang_thai,
        ngay_vao_lam: formData.ngay_vao_lam || undefined,
        role_id: formData.role_id || undefined,
        walletAddress: normalizedWallet,
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await apiService.updateEmployee(editingEmployee.employee_did, updateData);
      setSnackbar({ open: true, message: 'Cập nhật nhân viên thành công!', severity: 'success' });
      handleCloseDialog();
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi khi cập nhật nhân viên';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleDeleteEmployee = async (employeeDid) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác.')) {
      return;
    }

    try {
      await apiService.deleteEmployee(employeeDid);
      setSnackbar({ open: true, message: 'Xóa nhân viên thành công!', severity: 'success' });
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi khi xóa nhân viên';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const getDepartmentName = (departmentId) => {
    const department = departments.find(dept => dept.phong_ban_id === departmentId);
    return department ? department.ten_phong_ban : 'Chưa xác định';
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.role_id === roleId);
    return role ? role.ten_vai_tro : 'Chưa xác định';
  };

  const getRoleIcon = (roleId) => {
    const role = roles.find(r => r.role_id === roleId);
    if (role?.ten_vai_tro === 'Super Admin') return <AdminIcon fontSize="small" />;
    if (role?.ten_vai_tro === 'Manager') return <ManagerIcon fontSize="small" />;
    return <EmployeeIcon fontSize="small" />;
  };

  const getRoleColor = (roleId) => {
    const role = roles.find(r => r.role_id === roleId);
    if (role?.ten_vai_tro === 'Super Admin') return 'error';
    if (role?.ten_vai_tro === 'Manager') return 'primary';
    return 'default';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Đang làm việc': return 'success';
      case 'Nghỉ phép': return 'warning';
      case 'Tạm nghỉ': return 'info';
      case 'Đã nghỉ việc': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Đang làm việc': return <CheckCircleIcon fontSize="small" />;
      case 'Nghỉ phép': return <ScheduleIcon fontSize="small" />;
      case 'Tạm nghỉ': return <ScheduleIcon fontSize="small" />;
      case 'Đã nghỉ việc': return <CancelIcon fontSize="small" />;
      default: return null;
    }
  };

  // Helper function to get display name for employee
  const getEmployeeDisplayName = (employee) => {
    if (employee.ho_ten && employee.ho_ten.trim()) {
      return employee.ho_ten.trim();
    }
    if (employee.email && employee.email.trim()) {
      return employee.email.trim();
    }
    // Format employee_did to be more readable
    if (employee.employee_did) {
      const did = employee.employee_did;
      // If it's a UUID format, show first 8 chars
      if (did.includes('-')) {
        return did.split('-')[0];
      }
      return did.slice(0, 8);
    }
    return 'Chưa có thông tin';
  };


  // Export to CSV
  const handleExport = () => {
    const csvContent = [
      ['Mã NV', 'Họ tên', 'Email', 'Điện thoại', 'Chức vụ', 'Phòng ban', 'Vai trò', 'Trạng thái', 'Ngày vào làm', 'Ví'].join(','),
      ...filteredEmployees.map(emp => [
        emp.employee_did,
        emp.ho_ten || '',
        emp.email || '',
        emp.so_dien_thoai || '',
        emp.chuc_vu || '',
        getDepartmentName(emp.phong_ban_id),
        getRoleName(emp.role_id),
        emp.trang_thai,
        emp.ngay_vao_lam ? format(new Date(emp.ngay_vao_lam), 'dd/MM/yyyy') : '',
        emp.walletAddress || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nhan_vien_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
  };

  const normalizedWalletValue = formData.walletAddress?.trim() || '';
  const walletIsValid = isValidEthereumAddress(normalizedWalletValue);
  const originalWalletAddress = editingEmployee?.walletAddress?.toLowerCase() || null;
  const walletChanged = editingEmployee ? normalizedWalletValue.toLowerCase() !== originalWalletAddress : false;
  const saveDisabled =
    !editingEmployee ||
    !formData.chuc_vu ||
    !formData.phong_ban_id ||
    !walletIsValid ||
    walletStatus.type === 'error' ||
    (walletChanged && walletStatus.type !== 'success');

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
      <Box sx={{ pb: 4 }}>
        {/* Header */}
        <Box 
          sx={{ 
            mb: 4,
            pb: 3,
            borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography 
                variant="h4" 
                fontWeight={700} 
                color="text.primary" 
                gutterBottom
                sx={{ 
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Quản lý Nhân viên
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                Quản lý thông tin và hồ sơ nhân viên trong tổ chức
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              <Tooltip title="Chuyển đổi chế độ xem">
                <IconButton
                  onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                  sx={{
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                  }}
                >
                  {viewMode === 'table' ? <ViewModuleIcon /> : <ViewListIcon />}
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={filteredEmployees.length === 0}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Xuất CSV
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={fetchEmployees}
                disabled={loading}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                  }
                }}
              >
                Làm mới
              </Button>
            </Stack>
          </Box>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} mb={4}>
          {[
            { 
              label: 'Tổng nhân viên', 
              value: stats.total, 
              icon: GroupIcon, 
              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              delay: 0
            },
            { 
              label: 'Đang làm việc', 
              value: stats.active, 
              icon: CheckCircleIcon, 
              gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              delay: 100
            },
            { 
              label: 'Nghỉ phép', 
              value: stats.onLeave, 
              icon: ScheduleIcon, 
              gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              delay: 200
            },
            { 
              label: 'Đã nghỉ việc', 
              value: stats.resigned, 
              icon: CancelIcon, 
              gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              delay: 300
            },
            { 
              label: 'Ví đã xác thực', 
              value: stats.verified, 
              icon: VerifiedIcon, 
              gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              delay: 400
            }
          ].map((stat, index) => (
            <Grid item xs={12} sm={6} md={2.4} key={index}>
              <Zoom in={!loading} style={{ transitionDelay: `${stat.delay}ms` }}>
                <Card
                  sx={{
                    background: stat.gradient,
                    color: 'white',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': { 
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: `0 12px 24px ${alpha('#000', 0.2)}`
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(255,255,255,0.1)',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                    },
                    '&:hover::before': {
                      opacity: 1,
                    }
                  }}
                >
                  <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography 
                          variant="overline" 
                          sx={{ 
                            opacity: 0.9,
                            fontWeight: 600,
                            letterSpacing: 1,
                            fontSize: '0.7rem'
                          }}
                        >
                          {stat.label}
                        </Typography>
                        <Typography 
                          variant="h3" 
                          fontWeight={700}
                          sx={{ 
                            mt: 0.5,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          {loading ? <Skeleton width={60} /> : stat.value}
                        </Typography>
                      </Box>
                      <Avatar 
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.25)', 
                          width: 64, 
                          height: 64,
                          backdropFilter: 'blur(10px)',
                          border: '2px solid rgba(255,255,255,0.3)'
                        }}
                      >
                        <stat.icon sx={{ fontSize: 32 }} />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          ))}
        </Grid>

        {/* Tabs */}
        <Card 
          sx={{ 
            mb: 3,
            borderRadius: 3,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, v) => { setActiveTab(v); setPage(0); }}
            variant={isMobile ? "scrollable" : "fullWidth"}
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minHeight: 64,
                '&.Mui-selected': {
                  color: theme.palette.primary.main,
                }
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0'
              }
            }}
          >
            <Tab
              icon={
                <Box display="flex" alignItems="center" gap={1}>
                  <GroupIcon fontSize="small" />
                  <Chip 
                    label={stats.total} 
                    size="small" 
                    sx={{ 
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }} 
                  />
                </Box>
              }
              iconPosition="end"
              label="Tất cả"
            />
            <Tab
              icon={
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircleIcon fontSize="small" color="success" />
                  <Chip 
                    label={stats.active} 
                    size="small" 
                    color="success"
                    sx={{ 
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }} 
                  />
                </Box>
              }
              iconPosition="end"
              label="Đang làm việc"
            />
            <Tab
              icon={
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon fontSize="small" color="warning" />
                  <Chip 
                    label={stats.onLeave} 
                    size="small" 
                    color="warning"
                    sx={{ 
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }} 
                  />
                </Box>
              }
              iconPosition="end"
              label="Nghỉ phép"
            />
            <Tab
              icon={
                <Box display="flex" alignItems="center" gap={1}>
                  <CancelIcon fontSize="small" color="error" />
                  <Chip 
                    label={stats.resigned} 
                    size="small" 
                    color="error"
                    sx={{ 
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }} 
                  />
                </Box>
              }
              iconPosition="end"
              label="Đã nghỉ việc"
            />
          </Tabs>
        </Card>

        {/* Filters */}
        <Card 
          sx={{ 
            mb: 3,
            borderRadius: 3,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`
          }}
        >
          <CardContent sx={{ pb: filtersExpanded ? 2 : '16px !important' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={filtersExpanded ? 2 : 0}>
              <Box display="flex" alignItems="center" gap={1}>
                <FilterIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Bộ lọc & Tìm kiếm
                </Typography>
              </Box>
              <IconButton
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                sx={{
                  transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            {/* Search Bar - Always Visible */}
            <Grid container spacing={2} mb={filtersExpanded ? 2 : 0}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="medium"
                  placeholder="Tìm theo tên, mã NV, email, ví..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      },
                      '&.Mui-focused': {
                        bgcolor: 'transparent',
                      }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="primary" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton 
                          size="small" 
                          onClick={() => setSearchQuery('')}
                          sx={{ color: 'text.secondary' }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            </Grid>

            {/* Advanced Filters - Collapsible */}
            <Collapse in={filtersExpanded}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="medium">
                    <InputLabel>Phòng ban</InputLabel>
                    <Select
                      value={filterDepartment}
                      onChange={(e) => { setFilterDepartment(e.target.value); setPage(0); }}
                      label="Phòng ban"
                      sx={{ borderRadius: 2 }}
                      startAdornment={
                        <InputAdornment position="start" sx={{ ml: 1 }}>
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      }
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
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="medium">
                    <InputLabel>Vai trò</InputLabel>
                    <Select
                      value={filterRole}
                      onChange={(e) => { setFilterRole(e.target.value); setPage(0); }}
                      label="Vai trò"
                      sx={{ borderRadius: 2 }}
                      startAdornment={
                        <InputAdornment position="start" sx={{ ml: 1 }}>
                          <AdminIcon color="action" />
                        </InputAdornment>
                      }
                    >
                      <MenuItem value="all">Tất cả vai trò</MenuItem>
                      {roles.map(role => (
                        <MenuItem key={role.role_id} value={role.role_id}>
                          {role.ten_vai_tro}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="medium">
                    <InputLabel>Trạng thái</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                      label="Trạng thái"
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="all">Tất cả trạng thái</MenuItem>
                      <MenuItem value="Đang làm việc">Đang làm việc</MenuItem>
                      <MenuItem value="Nghỉ phép">Nghỉ phép</MenuItem>
                      <MenuItem value="Tạm nghỉ">Tạm nghỉ</MenuItem>
                      <MenuItem value="Đã nghỉ việc">Đã nghỉ việc</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Collapse>
          </CardContent>
        </Card>

        {/* Employees Display */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
            overflow: 'hidden'
          }}
        >
          {loading && <LinearProgress sx={{ height: 3 }} />}
          
          {loading ? (
            <Box p={3}>
              <Grid container spacing={2}>
                {[...Array(6)].map((_, idx) => (
                  <Grid item xs={12} sm={6} md={4} key={idx}>
                    <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : filteredEmployees.length === 0 ? (
            <Box sx={{ py: 12, textAlign: 'center' }}>
              <Fade in>
                <Box>
                  <GroupIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" fontWeight={600} gutterBottom>
                    Không tìm thấy nhân viên
                  </Typography>
                  <Typography variant="body1" color="text.disabled">
                    Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                  </Typography>
                </Box>
              </Fade>
            </Box>
          ) : viewMode === 'table' ? (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Nhân viên</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Liên hệ</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Chức vụ</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Phòng ban</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Vai trò</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Trạng thái</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Ngày vào làm</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEmployees
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((employee, idx) => (
                        <Fade in key={employee.employee_did} timeout={300} style={{ transitionDelay: `${idx * 50}ms` }}>
                          <TableRow
                            hover
                            sx={{
                              '&:hover': { 
                                bgcolor: alpha(theme.palette.primary.main, 0.04),
                                transform: 'scale(1.01)',
                                transition: 'all 0.2s'
                              },
                              borderLeft: employee.trang_thai === 'Đang làm việc'
                                ? `4px solid ${theme.palette.success.main}`
                                : employee.trang_thai === 'Đã nghỉ việc'
                                  ? `4px solid ${theme.palette.error.main}`
                                  : `4px solid ${theme.palette.warning.main}`,
                              transition: 'all 0.2s'
                            }}
                          >
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={2}>
                                <Badge
                                  overlap="circular"
                                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                  badgeContent={
                                    employee.wallet_verified ? (
                                      <VerifiedIcon sx={{ fontSize: 16, color: 'success.main', bgcolor: 'white', borderRadius: '50%', p: 0.5 }} />
                                    ) : null
                                  }
                                >
                                  <Avatar
                                    sx={{
                                      bgcolor: employee.trang_thai === 'Đang làm việc' 
                                        ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                                        : 'grey.400',
                                      width: 48,
                                      height: 48,
                                      fontWeight: 700,
                                      fontSize: '1.2rem'
                                    }}
                                  >
                                    {(employee.ho_ten || employee.employee_did || 'N')[0].toUpperCase()}
                                  </Avatar>
                                </Badge>
                                <Box flex={1} minWidth={0}>
                                  <Typography 
                                    variant="body1" 
                                    fontWeight={600}
                                    noWrap
                                  >
                                    {getEmployeeDisplayName(employee)}
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary" 
                                    sx={{ 
                                      fontFamily: 'monospace',
                                      display: 'block',
                                      mt: 0.25
                                    }}
                                  >
                                    {employee.employee_did?.slice(0, 12)}...
                                    {employee.email && 
                                     employee.ho_ten && 
                                     employee.email !== employee.ho_ten && (
                                      <span> • {employee.email}</span>
                                    )}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {onNavigateToChat ? (
                                <Tooltip title="Nhắn tin với nhân viên">
                                  <IconButton
                                    size="small"
                                    onClick={() => onNavigateToChat(employee.employee_did)}
                                    sx={{
                                      color: 'primary.main',
                                      '&:hover': { 
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        transform: 'scale(1.1)'
                                      },
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <ChatIcon />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Typography variant="body2" color="text.secondary">—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<WorkIcon fontSize="small" />}
                                label={employee.chuc_vu || 'Chưa xác định'}
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<BusinessIcon fontSize="small" />}
                                label={getDepartmentName(employee.phong_ban_id)}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={getRoleIcon(employee.role_id)}
                                label={getRoleName(employee.role_id)}
                                size="small"
                                color={getRoleColor(employee.role_id)}
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={getStatusIcon(employee.trang_thai)}
                                label={employee.trang_thai}
                                size="small"
                                color={getStatusColor(employee.trang_thai)}
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <CalendarIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
                                <Typography variant="body2">
                                  {employee.ngay_vao_lam
                                    ? format(new Date(employee.ngay_vao_lam), 'dd/MM/yyyy')
                                    : '—'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Box display="flex" justifyContent="center" gap={0.5}>
                                <Tooltip title="Chỉnh sửa">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog(employee)}
                                    sx={{
                                      color: 'primary.main',
                                      '&:hover': { 
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        transform: 'scale(1.1)'
                                      },
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Xóa">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteEmployee(employee.employee_did)}
                                    sx={{
                                      color: 'error.main',
                                      '&:hover': { 
                                        bgcolor: alpha(theme.palette.error.main, 0.1),
                                        transform: 'scale(1.1)'
                                      },
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        </Fade>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filteredEmployees.length}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Số hàng:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
                sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
              />
            </>
          ) : (
            <>
              <Box p={3}>
                <Grid container spacing={3}>
                  {filteredEmployees
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((employee, idx) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={employee.employee_did}>
                        <Zoom in timeout={300} style={{ transitionDelay: `${idx * 50}ms` }}>
                          <Card
                            sx={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              borderRadius: 3,
                              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                transform: 'translateY(-8px)',
                                boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                                borderColor: theme.palette.primary.main
                              },
                              borderLeft: `4px solid ${
                                employee.trang_thai === 'Đang làm việc'
                                  ? theme.palette.success.main
                                  : employee.trang_thai === 'Đã nghỉ việc'
                                    ? theme.palette.error.main
                                    : theme.palette.warning.main
                              }`
                            }}
                          >
                            <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                              <Box display="flex" alignItems="center" gap={2} mb={2}>
                                <Badge
                                  overlap="circular"
                                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                  badgeContent={
                                    employee.wallet_verified ? (
                                      <VerifiedIcon sx={{ fontSize: 18, color: 'success.main', bgcolor: 'white', borderRadius: '50%', p: 0.5 }} />
                                    ) : null
                                  }
                                >
                                  <Avatar
                                    sx={{
                                      bgcolor: employee.trang_thai === 'Đang làm việc'
                                        ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                                        : 'grey.400',
                                      width: 64,
                                      height: 64,
                                      fontWeight: 700,
                                      fontSize: '1.5rem'
                                    }}
                                  >
                                    {(employee.ho_ten || employee.employee_did || 'N')[0].toUpperCase()}
                                  </Avatar>
                                </Badge>
                                <Box flex={1} minWidth={0}>
                                  <Typography 
                                    variant="h6" 
                                    fontWeight={700} 
                                    noWrap
                                  >
                                    {getEmployeeDisplayName(employee)}
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary" 
                                    sx={{ 
                                      fontFamily: 'monospace',
                                      display: 'block',
                                      mt: 0.5
                                    }} 
                                    noWrap
                                  >
                                    {employee.employee_did?.slice(0, 16)}...
                                    {employee.email && 
                                     employee.ho_ten && 
                                     employee.email !== employee.ho_ten && (
                                      <span> • {employee.email}</span>
                                    )}
                                  </Typography>
                                </Box>
                              </Box>
                              
                              <Stack spacing={1.5} mt={2}>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <WorkIcon fontSize="small" color="action" />
                                  <Typography variant="body2" noWrap>
                                    {employee.chuc_vu || 'Chưa xác định'}
                                  </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <BusinessIcon fontSize="small" color="action" />
                                  <Typography variant="body2" noWrap>
                                    {getDepartmentName(employee.phong_ban_id)}
                                  </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <CalendarIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    {employee.ngay_vao_lam
                                      ? format(new Date(employee.ngay_vao_lam), 'dd/MM/yyyy')
                                      : 'Chưa có'}
                                  </Typography>
                                </Box>
                              </Stack>

                              <Box display="flex" gap={1} mt={2} flexWrap="wrap">
                                <Chip
                                  icon={getRoleIcon(employee.role_id)}
                                  label={getRoleName(employee.role_id)}
                                  size="small"
                                  color={getRoleColor(employee.role_id)}
                                  sx={{ fontSize: '0.7rem' }}
                                />
                                <Chip
                                  icon={getStatusIcon(employee.trang_thai)}
                                  label={employee.trang_thai}
                                  size="small"
                                  color={getStatusColor(employee.trang_thai)}
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              </Box>
                            </CardContent>
                            <Divider />
                            <CardActions sx={{ p: 1.5, justifyContent: 'space-between' }}>
                              {onNavigateToChat && (
                                <Tooltip title="Nhắn tin">
                                  <IconButton
                                    size="small"
                                    onClick={() => onNavigateToChat(employee.employee_did)}
                                    sx={{ color: 'primary.main' }}
                                  >
                                    <ChatIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Box>
                                <Tooltip title="Chỉnh sửa">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog(employee)}
                                    sx={{ color: 'primary.main' }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Xóa">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteEmployee(employee.employee_did)}
                                    sx={{ color: 'error.main' }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </CardActions>
                          </Card>
                        </Zoom>
                      </Grid>
                    ))}
                </Grid>
              </Box>
              <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, p: 2 }}>
                <TablePagination
                  component="div"
                  count={filteredEmployees.length}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                  rowsPerPageOptions={[8, 12, 24, 48]}
                  labelRowsPerPage="Số thẻ:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
                />
              </Box>
            </>
          )}
        </Card>

        {/* Employee Form Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ pb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon color="primary" />
            Chỉnh sửa Nhân viên
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Mã định danh (DID)"
                  value={formData.employee_did}
                  onChange={(e) => setFormData({ ...formData, employee_did: e.target.value })}
                  required
                  disabled={!!editingEmployee}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Chức vụ</InputLabel>
                  <Select
                    value={formData.chuc_vu}
                    onChange={(e) => setFormData({ ...formData, chuc_vu: e.target.value })}
                    label="Chức vụ"
                  >
                    {['Intern', 'Junior Developer', 'Senior Developer', 'Tech Lead', 'Designer',
                      'QA Engineer', 'DevOps Engineer', 'Data Engineer', 'Data Scientist',
                      'Product Manager', 'Project Manager', 'HR Specialist', 'Finance Analyst',
                      'Sales Executive', 'Customer Support', 'Marketing Specialist', 'Team Lead',
                      'Manager', 'Director', 'VP', 'CTO', 'CFO', 'COO', 'CEO'].map(pos => (
                        <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Phòng ban</InputLabel>
                  <Select
                    value={formData.phong_ban_id}
                    onChange={(e) => setFormData({ ...formData, phong_ban_id: e.target.value })}
                    label="Phòng ban"
                  >
                    <MenuItem value=""><em>Chưa xác định</em></MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept.phong_ban_id} value={dept.phong_ban_id}>
                        {dept.ten_phong_ban}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Vai trò</InputLabel>
                  <Select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    label="Vai trò"
                  >
                    <MenuItem value=""><em>Chưa xác định</em></MenuItem>
                    {roles.map((role) => (
                      <MenuItem key={role.role_id} value={role.role_id}>
                        {role.ten_vai_tro}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Trạng thái</InputLabel>
                  <Select
                    value={formData.trang_thai}
                    onChange={(e) => setFormData({ ...formData, trang_thai: e.target.value })}
                    label="Trạng thái"
                  >
                    <MenuItem value="Đang làm việc">Đang làm việc</MenuItem>
                    <MenuItem value="Nghỉ phép">Nghỉ phép</MenuItem>
                    <MenuItem value="Tạm nghỉ">Tạm nghỉ</MenuItem>
                    <MenuItem value="Đã nghỉ việc">Đã nghỉ việc</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Ngày vào làm"
                  type="date"
                  value={formData.ngay_vao_lam ? format(formData.ngay_vao_lam instanceof Date ? formData.ngay_vao_lam : new Date(formData.ngay_vao_lam), 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const dateValue = e.target.value;
                    setFormData({ ...formData, ngay_vao_lam: dateValue ? new Date(dateValue) : null });
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }}>
                  <Chip label="Thông tin Blockchain" icon={<AccountBalanceWalletIcon />} />
                </Divider>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Địa chỉ ví (Wallet Address)"
                  value={formData.walletAddress}
                  onChange={(e) => handleWalletInputChange(e.target.value)}
                  onBlur={() => walletStatus.type === 'format-ok' && checkWalletAvailability(formData.walletAddress)}
                  required
                  error={walletStatus.type === 'error'}
                  helperText={walletStatus.message}
                  FormHelperTextProps={{
                    sx: {
                      color: walletStatus.type === 'error' ? 'error.main'
                        : walletStatus.type === 'success' ? 'success.main'
                          : 'text.secondary'
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccountBalanceWalletIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box mt={2} display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    startIcon={<AccountBalanceWalletIcon />}
                    onClick={handleConnectWallet}
                    disabled={connectingWallet}
                  >
                    {connectingWallet ? 'Đang kết nối...' : 'Lấy từ MetaMask'}
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => checkWalletAvailability(formData.walletAddress)}
                    disabled={checkingWallet || !isValidEthereumAddress(formData.walletAddress)}
                  >
                    {checkingWallet ? 'Đang kiểm tra...' : 'Kiểm tra trùng'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog} variant="outlined">
              Hủy
            </Button>
            <Button
              onClick={handleSaveEmployee}
              variant="contained"
              disabled={saveDisabled}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                },
                '&:disabled': {
                  background: 'grey.300'
                }
              }}
            >
              Cập nhật
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

export default EmployeeManagement;
