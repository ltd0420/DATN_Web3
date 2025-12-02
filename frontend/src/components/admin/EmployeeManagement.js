import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Tooltip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Avatar, Alert, Snackbar, FormControl, InputLabel, Select, MenuItem,
  InputAdornment, TablePagination, LinearProgress, Skeleton, Divider,
  Badge, Tabs, Tab, alpha
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
  Chat as ChatIcon
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

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
              Quản lý Nhân viên
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Quản lý thông tin và hồ sơ nhân viên trong tổ chức
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={filteredEmployees.length === 0}
            >
              Xuất CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchEmployees}
              disabled={loading}
            >
              Làm mới
            </Button>
          </Box>
        </Box>

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
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng nhân viên</Typography>
                    <Typography variant="h3" fontWeight="bold">{stats.total}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <GroupIcon sx={{ fontSize: 28 }} />
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
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Đang làm việc</Typography>
                    <Typography variant="h3" fontWeight="bold">{stats.active}</Typography>
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
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' }
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Nghỉ phép</Typography>
                    <Typography variant="h3" fontWeight="bold">{stats.onLeave}</Typography>
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
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Đã nghỉ việc</Typography>
                    <Typography variant="h3" fontWeight="bold">{stats.resigned}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <CancelIcon sx={{ fontSize: 28 }} />
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
                    <Typography variant="overline" sx={{ opacity: 0.8 }}>Ví đã xác thực</Typography>
                    <Typography variant="h3" fontWeight="bold">{stats.verified}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                    <VerifiedIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={(e, v) => { setActiveTab(v); setPage(0); }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <GroupIcon fontSize="small" />
                    <span>Tất cả</span>
                    <Chip label={stats.total} size="small" sx={{ ml: 1 }} />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircleIcon fontSize="small" color="success" />
                    <span>Đang làm việc</span>
                    <Chip label={stats.active} size="small" color="success" sx={{ ml: 1 }} />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <ScheduleIcon fontSize="small" color="warning" />
                    <span>Nghỉ phép</span>
                    <Chip label={stats.onLeave} size="small" color="warning" sx={{ ml: 1 }} />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <CancelIcon fontSize="small" color="error" />
                    <span>Đã nghỉ việc</span>
                    <Chip label={stats.resigned} size="small" color="error" sx={{ ml: 1 }} />
                  </Box>
                }
              />
            </Tabs>
          </Box>
        </Card>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Tìm theo tên, mã NV, email, ví..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchQuery('')}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Phòng ban</InputLabel>
                  <Select
                    value={filterDepartment}
                    onChange={(e) => { setFilterDepartment(e.target.value); setPage(0); }}
                    label="Phòng ban"
                    startAdornment={<BusinessIcon sx={{ ml: 1, mr: 0.5, color: 'action.active' }} />}
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
              <Grid item xs={12} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Vai trò</InputLabel>
                  <Select
                    value={filterRole}
                    onChange={(e) => { setFilterRole(e.target.value); setPage(0); }}
                    label="Vai trò"
                    startAdornment={<AdminIcon sx={{ ml: 1, mr: 0.5, color: 'action.active' }} />}
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
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Trạng thái</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                    label="Trạng thái"
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
          </CardContent>
        </Card>

        {/* Employees Table */}
        <Card>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Nhân viên</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Liên hệ</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Chức vụ</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Phòng ban</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Vai trò</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ngày vào làm</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, idx) => (
                    <TableRow key={idx}>
                      {[...Array(8)].map((_, cellIdx) => (
                        <TableCell key={cellIdx}><Skeleton animation="wave" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        <GroupIcon sx={{ fontSize: 64, color: 'grey.300' }} />
                        <Typography variant="h6" color="text.secondary">
                          Không tìm thấy nhân viên
                        </Typography>
                        <Typography variant="body2" color="text.disabled">
                          Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((employee) => (
                      <TableRow
                        key={employee.employee_did}
                        hover
                        sx={{
                          '&:hover': { bgcolor: alpha('#667eea', 0.04) },
                          borderLeft: employee.trang_thai === 'Đang làm việc'
                            ? '4px solid #4caf50'
                            : employee.trang_thai === 'Đã nghỉ việc'
                              ? '4px solid #f44336'
                              : '4px solid #ff9800'
                        }}
                      >
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Badge
                              overlap="circular"
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              badgeContent={
                                employee.wallet_verified ? (
                                  <VerifiedIcon sx={{ fontSize: 14, color: 'success.main', bgcolor: 'white', borderRadius: '50%' }} />
                                ) : null
                              }
                            >
                              <Avatar
                                sx={{
                                  bgcolor: employee.trang_thai === 'Đang làm việc' ? 'primary.main' : 'grey.400',
                                  width: 44,
                                  height: 44
                                }}
                              >
                                {(employee.ho_ten || employee.employee_did || 'N')[0].toUpperCase()}
                              </Avatar>
                            </Badge>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {employee.ho_ten || 'Chưa cập nhật'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {employee.employee_did?.slice(0, 8)}...
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
                                  '&:hover': { bgcolor: alpha('#667eea', 0.1) }
                                }}
                              >
                                <ChatIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<WorkIcon />}
                            label={employee.chuc_vu || 'Chưa xác định'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<BusinessIcon />}
                            label={getDepartmentName(employee.phong_ban_id)}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={getRoleIcon(employee.role_id)}
                            label={getRoleName(employee.role_id)}
                            size="small"
                            color={getRoleColor(employee.role_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(employee.trang_thai)}
                            label={employee.trang_thai}
                            size="small"
                            color={getStatusColor(employee.trang_thai)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {employee.ngay_vao_lam
                              ? format(new Date(employee.ngay_vao_lam), 'dd/MM/yyyy')
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" justifyContent="center" gap={0.5}>
                            <Tooltip title="Chỉnh sửa">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(employee)}
                                sx={{
                                  color: 'primary.main',
                                  '&:hover': { bgcolor: alpha('#667eea', 0.1) }
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
                                  '&:hover': { bgcolor: alpha('#f44336', 0.1) }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
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
          />
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
