import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Tooltip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Avatar, Alert, Snackbar, FormControl, InputLabel, Select, MenuItem,
  InputAdornment, LinearProgress, Skeleton, Divider, TablePagination,
  Paper, Badge, Collapse, List, ListItem, ListItemAvatar, ListItemText, alpha,
  Tabs, Tab, Switch, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Work as WorkIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as TaskIcon,
  TrendingUp as TrendingUpIcon,
  SupervisorAccount as ManagerIcon,
  Group as GroupIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  AccountTree as OrgIcon,
  Quiz as QuizIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import authService from '../../services/authService';
import { format } from 'date-fns';
import TestQuestionManagement from './TestQuestionManagement';

// Color palette for departments
const departmentColors = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
];

const DepartmentManagement = ({ user, onDataUpdate }) => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    ten_phong_ban: '',
    mo_ta: '',
    truong_phong_did: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [currentUser, setCurrentUser] = useState(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDept, setExpandedDept] = useState(null);

  // Pagination for table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // View mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('cards');
  
  // Tab state for Web3 test questions
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedDepartmentForTest, setSelectedDepartmentForTest] = useState(null);
  
  // Web3 departments state
  const [web3Departments, setWeb3Departments] = useState([]);
  const [web3Loading, setWeb3Loading] = useState(false);
  const [web3DialogOpen, setWeb3DialogOpen] = useState(false);
  const [web3FormData, setWeb3FormData] = useState({
    department_id: '',
    department_name: '',
    require_test: true,
    min_test_score: 70
  });
  const [web3MembersDialog, setWeb3MembersDialog] = useState(false);
  const [selectedWeb3DepartmentMembers, setSelectedWeb3DepartmentMembers] = useState(null);

  useEffect(() => {
    fetchData();
    if (selectedTab === 2) {
      loadWeb3Departments();
    }

    const handleDepartmentHeadAssigned = (data) => {
      fetchDepartments();
      fetchEmployees();
    };

    if (window.socket) {
      window.socket.on('department_head_assigned', handleDepartmentHeadAssigned);
    }

    return () => {
      if (window.socket) {
        window.socket.off('department_head_assigned', handleDepartmentHeadAssigned);
      }
    };
  }, [selectedTab]);

  // Statistics
  const stats = useMemo(() => {
    const totalDepartments = departments.length;
    const totalEmployees = employees.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.trang_thai === 'Hoàn thành').length;
    const deptsWithManager = departments.filter(d => d.truong_phong_did).length;

    return { totalDepartments, totalEmployees, totalTasks, completedTasks, deptsWithManager };
  }, [departments, employees, tasks]);

  // Filtered departments
  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departments;
    const query = searchQuery.toLowerCase();
    return departments.filter(dept => {
      const matchName = dept.ten_phong_ban?.toLowerCase().includes(query);
      const matchDesc = dept.mo_ta?.toLowerCase().includes(query);
      const manager = employees.find(e => e.employee_did === dept.truong_phong_did);
      const matchManager = manager?.ho_ten?.toLowerCase().includes(query);
      return matchName || matchDesc || matchManager;
    });
  }, [departments, employees, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const basicUser = await authService.getCurrentUser();
      const empRes = await apiService.getEmployees();
      setEmployees(empRes || []);

      const fullUserProfile = (empRes || []).find(emp => emp.employee_did === basicUser.did);
      setCurrentUser(fullUserProfile || basicUser);

      const [deptRes, taskRes, rolesRes] = await Promise.all([
        apiService.getDepartments(),
        apiService.getAllTasks(),
        apiService.get('/roles')
      ]);

      // Ensure departments is an array
      const departmentsArray = Array.isArray(deptRes) ? deptRes : (deptRes?.data || []);
      setDepartments(departmentsArray);
      setTasks(taskRes || []);
      setRoles(rolesRes.data?.roles || []);
      
      // Debug: Log departments with truong_phong_did after all data is set
      setTimeout(() => {
        const deptsWithManager = departmentsArray.filter(d => d.truong_phong_did);
        if (deptsWithManager.length > 0) {
          console.log('[DepartmentManagement] Departments with manager:', deptsWithManager.map(d => ({
            name: d.ten_phong_ban,
            truong_phong_did: d.truong_phong_did
          })));
          console.log('[DepartmentManagement] Available employees:', empRes?.length || 0);
          console.log('[DepartmentManagement] Employee IDs sample:', (empRes || []).slice(0, 5).map(e => e?.employee_did));
          
          // Check if managers can be found
          deptsWithManager.forEach(dept => {
            const manager = (empRes || []).find(emp => emp.employee_did === dept.truong_phong_did);
            if (!manager) {
              console.warn(`[DepartmentManagement] Manager not found for ${dept.ten_phong_ban}:`, {
                truong_phong_did: dept.truong_phong_did,
                found: false
              });
            }
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({ open: true, message: 'Lỗi khi tải dữ liệu', severity: 'error' });
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

  const fetchEmployees = async () => {
    try {
      const response = await apiService.getEmployees();
      setEmployees(response || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleOpenDialog = (department = null) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({
        ten_phong_ban: department.ten_phong_ban,
        mo_ta: department.mo_ta || '',
        truong_phong_did: department.truong_phong_did || ''
      });
    } else {
      setEditingDepartment(null);
      setFormData({ ten_phong_ban: '', mo_ta: '', truong_phong_did: '' });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDepartment(null);
  };

  const handleSaveDepartment = async () => {
    try {
      const managerRole = roles.find(r => r.ten_vai_tro === 'Manager');
      const employeeRole = roles.find(r => r.ten_vai_tro === 'Employee');

      if (!employeeRole || !managerRole) {
        setSnackbar({ open: true, message: 'Không tìm thấy vai trò cần thiết.', severity: 'error' });
        return;
      }

      const oldManagerId = editingDepartment?.truong_phong_did;
      const newManagerId = formData.truong_phong_did;

      if (editingDepartment) {
        const departmentId = editingDepartment.phong_ban_id;
        await apiService.updateDepartment(departmentId, formData);

        if (oldManagerId !== newManagerId) {
          if (oldManagerId) {
            await apiService.updateEmployee(oldManagerId, { role_id: employeeRole.role_id });
          }
          if (newManagerId) {
            await apiService.updateEmployee(newManagerId, {
              role_id: managerRole.role_id,
              phong_ban_id: departmentId
            });
          }
        }
        setSnackbar({ open: true, message: 'Cập nhật phòng ban thành công!', severity: 'success' });
      } else {
        const newDepartmentData = { ...formData, phong_ban_id: uuidv4() };
        await apiService.createDepartment(newDepartmentData);

        if (newManagerId) {
          await apiService.updateEmployee(newManagerId, {
            role_id: managerRole.role_id,
            phong_ban_id: newDepartmentData.phong_ban_id
          });
        }
        setSnackbar({ open: true, message: 'Tạo phòng ban thành công!', severity: 'success' });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Lỗi khi lưu', severity: 'error' });
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phòng ban này?')) {
      try {
        await apiService.deleteDepartment(departmentId);
        setSnackbar({ open: true, message: 'Xóa thành công!', severity: 'success' });
        fetchData();
      } catch (error) {
        setSnackbar({ open: true, message: 'Lỗi khi xóa', severity: 'error' });
      }
    }
  };

  const getManagerInfo = (managerId) => {
    if (!managerId) return null;
    
    // Trim và normalize để tránh vấn đề với whitespace
    const normalizedManagerId = managerId.trim();
    
    // Tìm employee với nhiều cách so sánh
    const manager = employees.find(emp => {
      if (!emp || !emp.employee_did) return false;
      const normalizedEmpId = emp.employee_did.trim();
      return normalizedEmpId === normalizedManagerId;
    });
    
    // Debug log nếu không tìm thấy nhưng có managerId
    if (!manager && normalizedManagerId) {
      console.warn('[DepartmentManagement] Manager not found:', {
        managerId: normalizedManagerId,
        totalEmployees: employees.length,
        employeeIds: employees.map(e => e?.employee_did).slice(0, 5)
      });
    }
    
    return manager;
  };

  const getDepartmentStats = (department) => {
    const deptTasks = tasks.filter(task => task.phong_ban_id === department.phong_ban_id);
    const activeTasks = deptTasks.filter(task => task.trang_thai === 'Đang thực hiện' || task.trang_thai === 'Chờ bắt đầu').length;
    const completedTasks = deptTasks.filter(task => task.trang_thai === 'Hoàn thành').length;
    const totalEmployees = employees.filter(emp => emp.phong_ban_id === department.phong_ban_id).length;

    return { totalEmployees, activeTasks, completedTasks, totalTasks: deptTasks.length };
  };

  const getDepartmentEmployees = (departmentId) => {
    return employees.filter(emp => emp.phong_ban_id === departmentId);
  };

  const getAvailableManagers = (editingDeptId) => {
    const assignedManagerIds = departments
      .filter(dept => dept.phong_ban_id !== editingDeptId && dept.truong_phong_did)
      .map(dept => dept.truong_phong_did);

    return employees.filter(emp => !assignedManagerIds.includes(emp.employee_did));
  };

  const getDepartmentColor = (index) => {
    return departmentColors[index % departmentColors.length];
  };

  // Web3 Department functions
  const loadWeb3Departments = async () => {
    setWeb3Loading(true);
    try {
      const response = await apiService.get('/web3/departments');
      setWeb3Departments(response.data || []);
    } catch (error) {
      console.error('Error loading Web3 departments:', error);
      setSnackbar({ open: true, message: 'Không thể tải danh sách phòng ban Web3', severity: 'error' });
    } finally {
      setWeb3Loading(false);
    }
  };

  const handleCreateWeb3Department = async () => {
    try {
      const response = await apiService.post('/web3/departments', web3FormData);
      const department = response.data;
      
      let message = 'Tạo phòng ban Web3 thành công!';
      if (department.blockchain_tx_hash) {
        message += ` Transaction: ${department.blockchain_tx_hash.slice(0, 10)}...`;
      }
      
      setSnackbar({ open: true, message, severity: 'success' });
      setWeb3DialogOpen(false);
      setWeb3FormData({
        department_id: '',
        department_name: '',
        require_test: true,
        min_test_score: 70
      });
      loadWeb3Departments();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Không thể tạo phòng ban', severity: 'error' });
    }
  };

  const handleDeleteWeb3Department = async (departmentId, departmentName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng ban "${departmentName}"?\n\nCảnh báo: Tất cả dữ liệu liên quan (thành viên, câu hỏi test, kết quả bỏ phiếu) sẽ bị xóa vĩnh viễn!`)) {
      return;
    }

    try {
      await apiService.delete(`/web3/departments/${departmentId}`);
      setSnackbar({ open: true, message: 'Xóa phòng ban thành công!', severity: 'success' });
      loadWeb3Departments();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Không thể xóa phòng ban', severity: 'error' });
    }
  };

  const handleViewWeb3Members = async (departmentId) => {
    try {
      const response = await apiService.get(`/web3/departments/${departmentId}/members`);
      setSelectedWeb3DepartmentMembers({
        department: web3Departments.find(d => d.department_id === departmentId),
        members: response.data || []
      });
      setWeb3MembersDialog(true);
    } catch (error) {
      setSnackbar({ open: true, message: 'Không thể tải danh sách thành viên', severity: 'error' });
    }
  };

  // Export to CSV
  const handleExport = () => {
    const csvContent = [
      ['Tên phòng ban', 'Mô tả', 'Trưởng phòng', 'Employee ID', 'Số nhân viên', 'Số dự án', 'Ngày tạo'].join(','),
      ...filteredDepartments.map(dept => {
        const stats = getDepartmentStats(dept);
        const manager = getManagerInfo(dept.truong_phong_did);
        return [
          dept.ten_phong_ban,
          dept.mo_ta || '',
          manager?.ho_ten || (dept.truong_phong_did ? dept.truong_phong_did : 'Chưa chỉ định'),
          manager?.employee_did || dept.truong_phong_did || '',
          stats.totalEmployees,
          stats.totalTasks,
          dept.createdAt ? format(new Date(dept.createdAt), 'dd/MM/yyyy') : ''
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `phong_ban_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
            Quản lý Phòng ban
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Tổ chức và quản lý cơ cấu phòng ban trong doanh nghiệp
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={filteredDepartments.length === 0}
          >
            Xuất CSV
          </Button>
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
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
              }
            }}
          >
            Thêm Phòng ban
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
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng phòng ban</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.totalDepartments}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <BusinessIcon sx={{ fontSize: 28 }} />
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
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng nhân viên</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.totalEmployees}</Typography>
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
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Có trưởng phòng</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.deptsWithManager}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <ManagerIcon sx={{ fontSize: 28 }} />
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
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Tổng dự án</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.totalTasks}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <TaskIcon sx={{ fontSize: 28 }} />
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
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>Hoàn thành</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.completedTasks}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <CheckCircleIcon sx={{ fontSize: 28 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Card with Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Danh Sách Phòng Ban" />
          <Tab label="Quản Lý Câu Hỏi Test" />
          <Tab label="Phòng Ban Web3" />
        </Tabs>

        {selectedTab === 1 && (
          <Box sx={{ p: 3 }}>
            {departments.length > 0 ? (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Chọn Phòng Ban Để Quản Lý Câu Hỏi Test</Typography>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Chọn Phòng Ban</InputLabel>
                  <Select
                    value={selectedDepartmentForTest || ''}
                    onChange={(e) => setSelectedDepartmentForTest(e.target.value)}
                    label="Chọn Phòng Ban"
                  >
                    {departments.map((dept) => (
                      <MenuItem key={dept.phong_ban_id} value={dept.phong_ban_id}>
                        {dept.ten_phong_ban}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedDepartmentForTest && (
                  <TestQuestionManagement
                    departmentId={selectedDepartmentForTest}
                    departmentName={departments.find(d => d.phong_ban_id === selectedDepartmentForTest)?.ten_phong_ban || ''}
                  />
                )}
              </Box>
            ) : (
              <Alert severity="info">Chưa có phòng ban nào. Vui lòng tạo phòng ban trước.</Alert>
            )}
          </Box>
        )}

        {selectedTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Quản Lý Phòng Ban Web3</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setWeb3DialogOpen(true)}
              >
                Tạo Phòng Ban Web3
              </Button>
            </Box>

            {web3Loading && <LinearProgress sx={{ mb: 2 }} />}

            <Grid container spacing={2}>
              {web3Departments.map((dept) => (
                <Grid item xs={12} md={6} lg={4} key={dept.department_id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6">{dept.department_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {dept.department_id}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={dept.is_active ? 'Hoạt Động' : 'Không Hoạt Động'}
                            color={dept.is_active ? 'success' : 'default'}
                            size="small"
                          />
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleDeleteWeb3Department(dept.department_id, dept.department_name)}
                            title="Xóa phòng ban"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        {dept.require_test && (
                          <Chip
                            icon={<QuizIcon />}
                            label={`Test: ≥${dept.min_test_score} điểm`}
                            size="small"
                            color="primary"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        )}
                      </Box>

                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PeopleIcon />}
                        onClick={() => handleViewWeb3Members(dept.department_id)}
                        fullWidth
                        sx={{ mb: 2 }}
                      >
                        Xem Thành Viên
                      </Button>
                      
                      {/* Blockchain Transaction Link */}
                      {dept.blockchain_tx_hash && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<OpenInNewIcon />}
                            href={`https://sepolia.etherscan.io/tx/${dept.blockchain_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            fullWidth
                          >
                            Xem Transaction Create Department
                          </Button>
                          {dept.blockchain_block_number && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                              Block: {dept.blockchain_block_number}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {!web3Loading && web3Departments.length === 0 && (
                <Grid item xs={12}>
                  <Alert severity="info">Chưa có phòng ban Web3 nào.</Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {selectedTab === 0 && (
          <Box>
            {/* Search Bar */}
        <CardContent sx={{ py: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm phòng ban, trưởng phòng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
            <Grid item xs={12} md={6}>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Chip
                  label={`${filteredDepartments.length} phòng ban`}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Department Cards Grid */}
      <Grid container spacing={3} mb={4}>
        {loading ? (
          [...Array(6)].map((_, idx) => (
            <Grid item xs={12} md={6} lg={4} key={idx}>
              <Card sx={{ height: 320 }}>
                <CardContent>
                  <Skeleton variant="circular" width={56} height={56} />
                  <Skeleton variant="text" sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : filteredDepartments.length === 0 ? (
          <Grid item xs={12}>
            <Box display="flex" flexDirection="column" alignItems="center" py={8}>
              <BusinessIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Không tìm thấy phòng ban
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Thử thay đổi từ khóa tìm kiếm
              </Typography>
            </Box>
          </Grid>
        ) : (
          filteredDepartments.map((department, index) => {
            const deptStats = getDepartmentStats(department);
            const manager = getManagerInfo(department.truong_phong_did);
            const deptEmployees = getDepartmentEmployees(department.phong_ban_id);
            const isExpanded = expandedDept === department.phong_ban_id;

            return (
              <Grid item xs={12} md={6} lg={4} key={department.phong_ban_id}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'all 0.3s ease',
                    overflow: 'visible',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  {/* Header with gradient */}
                  <Box
                    sx={{
                      background: getDepartmentColor(index),
                      p: 3,
                      borderRadius: '12px 12px 0 0',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        right: -20,
                        top: -20,
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)'
                      }}
                    />
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          width: 56,
                          height: 56,
                          border: '3px solid rgba(255,255,255,0.3)'
                        }}
                      >
                        <BusinessIcon sx={{ fontSize: 28, color: 'white' }} />
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="h6" fontWeight="bold" color="white">
                          {department.ten_phong_ban}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {department.mo_ta || 'Không có mô tả'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <CardContent sx={{ p: 3 }}>
                    {/* Manager Info */}
                    <Box mb={3}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        TRƯỞNG PHÒNG
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1.5} mt={1}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: manager ? 'primary.main' : 'grey.300'
                          }}
                        >
                          {manager ? manager.ho_ten?.[0] || 'M' : '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {manager?.ho_ten || (department.truong_phong_did ? department.truong_phong_did : 'Chưa chỉ định')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {manager ? (manager.employee_did || manager.chuc_vu || 'N/A') : (department.truong_phong_did ? department.truong_phong_did : 'N/A')}
                          </Typography>
                          {!manager && department.truong_phong_did && (
                            <Typography variant="caption" color="warning.main" display="block">
                              (Không tìm thấy trong danh sách)
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Statistics */}
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={4}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            textAlign: 'center',
                            borderRadius: 2,
                            bgcolor: alpha('#667eea', 0.05)
                          }}
                        >
                          <Typography variant="h5" fontWeight="bold" color="primary.main">
                            {deptStats.totalEmployees}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Nhân viên
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            textAlign: 'center',
                            borderRadius: 2,
                            bgcolor: alpha('#f5576c', 0.05)
                          }}
                        >
                          <Typography variant="h5" fontWeight="bold" color="warning.main">
                            {deptStats.activeTasks}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Đang làm
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            textAlign: 'center',
                            borderRadius: 2,
                            bgcolor: alpha('#38ef7d', 0.05)
                          }}
                        >
                          <Typography variant="h5" fontWeight="bold" color="success.main">
                            {deptStats.completedTasks}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Hoàn thành
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Expand employees */}
                    <Button
                      fullWidth
                      variant="text"
                      size="small"
                      onClick={() => setExpandedDept(isExpanded ? null : department.phong_ban_id)}
                      endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      sx={{ mb: 1 }}
                    >
                      {isExpanded ? 'Thu gọn' : `Xem ${deptStats.totalEmployees} nhân viên`}
                    </Button>

                    <Collapse in={isExpanded}>
                      <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', borderRadius: 2 }}>
                        <List dense>
                          {deptEmployees.length === 0 ? (
                            <ListItem>
                              <ListItemText
                                primary="Chưa có nhân viên"
                                primaryTypographyProps={{ color: 'text.secondary', align: 'center' }}
                              />
                            </ListItem>
                          ) : (
                            deptEmployees.map(emp => (
                              <ListItem key={emp.employee_did}>
                                <ListItemAvatar>
                                  <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                                    {(emp.ho_ten || emp.employee_did)?.[0]}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={emp.ho_ten || emp.employee_did}
                                  secondary={emp.chuc_vu}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                  secondaryTypographyProps={{ variant: 'caption' }}
                                />
                              </ListItem>
                            ))
                          )}
                        </List>
                      </Paper>
                    </Collapse>

                    <Divider sx={{ my: 2 }} />

                    {/* Actions */}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Tạo: {department.createdAt ? format(new Date(department.createdAt), 'dd/MM/yyyy') : 'N/A'}
                      </Typography>
                      <Box>
                        <Tooltip title="Chỉnh sửa">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(department)}
                            sx={{ color: 'primary.main' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDepartment(department.phong_ban_id)}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      {/* Department Table */}
      <Box>
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box p={3} pb={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight="bold">
              Danh sách chi tiết
            </Typography>
            <Chip label={`${filteredDepartments.length} phòng ban`} size="small" />
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Phòng ban</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trưởng phòng</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Nhân viên</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Dự án</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Hoàn thành</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ngày tạo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDepartments
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((department, index) => {
                    const deptStats = getDepartmentStats(department);
                    const manager = getManagerInfo(department.truong_phong_did);
                    return (
                      <TableRow key={department.phong_ban_id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar
                              sx={{
                                background: getDepartmentColor(index),
                                width: 40,
                                height: 40
                              }}
                            >
                              <BusinessIcon fontSize="small" />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {department.ten_phong_ban}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                                {department.mo_ta || 'Không có mô tả'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: (manager || department.truong_phong_did) ? 'primary.main' : 'grey.300' }}>
                              {manager ? (manager.ho_ten?.[0] || 'M') : (department.truong_phong_did ? 'M' : '?')}
                            </Avatar>
                            <Box>
                              <Typography variant="body2">
                                {manager?.ho_ten || (department.truong_phong_did ? department.truong_phong_did : 'Chưa chỉ định')}
                              </Typography>
                              {manager && (
                                <Typography variant="caption" color="text.secondary">
                                  {manager.employee_did}
                                </Typography>
                              )}
                              {!manager && department.truong_phong_did && (
                                <Typography variant="caption" color="warning.main">
                                  (Không tìm thấy trong danh sách nhân viên)
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={<PeopleIcon />}
                            label={deptStats.totalEmployees}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={<TaskIcon />}
                            label={deptStats.totalTasks}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={<CheckCircleIcon />}
                            label={deptStats.completedTasks}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {department.createdAt ? format(new Date(department.createdAt), 'dd/MM/yyyy') : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Chỉnh sửa">
                            <IconButton size="small" onClick={() => handleOpenDialog(department)} color="primary">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Xóa">
                            <IconButton size="small" onClick={() => handleDeleteDepartment(department.phong_ban_id)} color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredDepartments.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Số hàng:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </CardContent>
        </Card>
      </Box>
          </Box>
        )}
      </Card>

      {/* Department Form Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          {editingDepartment ? <EditIcon color="primary" /> : <AddIcon color="primary" />}
          {editingDepartment ? 'Chỉnh sửa Phòng ban' : 'Tạo Phòng ban Mới'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tên phòng ban"
                value={formData.ten_phong_ban}
                onChange={(e) => setFormData({ ...formData, ten_phong_ban: e.target.value })}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Mô tả"
                multiline
                rows={3}
                value={formData.mo_ta}
                onChange={(e) => setFormData({ ...formData, mo_ta: e.target.value })}
                placeholder="Mô tả ngắn gọn về chức năng của phòng ban..."
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Trưởng phòng</InputLabel>
                <Select
                  value={formData.truong_phong_did}
                  onChange={(e) => setFormData({ ...formData, truong_phong_did: e.target.value })}
                  label="Trưởng phòng"
                  startAdornment={<ManagerIcon sx={{ ml: 1, mr: 0.5, color: 'action.active' }} />}
                >
                  <MenuItem value="">
                    <em>Chưa chỉ định</em>
                  </MenuItem>
                  {getAvailableManagers(editingDepartment?.phong_ban_id).map((employee) => (
                    <MenuItem key={employee.employee_did} value={employee.employee_did}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                          {(employee.ho_ten || employee.employee_did)?.[0]}
                        </Avatar>
                        {employee.ho_ten || employee.employee_did}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Hủy
          </Button>
          <Button
            onClick={handleSaveDepartment}
            variant="contained"
            disabled={!formData.ten_phong_ban.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
              }
            }}
          >
            {editingDepartment ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Web3 Create Department Dialog */}
      <Dialog open={web3DialogOpen} onClose={() => setWeb3DialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tạo Phòng Ban Web3</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Mã Phòng Ban"
              value={web3FormData.department_id}
              onChange={(e) => setWeb3FormData({ ...web3FormData, department_id: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Tên Phòng Ban"
              value={web3FormData.department_name}
              onChange={(e) => setWeb3FormData({ ...web3FormData, department_name: e.target.value })}
              margin="normal"
              required
            />

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={web3FormData.require_test}
                    onChange={(e) => setWeb3FormData({ ...web3FormData, require_test: e.target.checked })}
                  />
                }
                label="Yêu Cầu Test"
              />
              {web3FormData.require_test && (
                <TextField
                  fullWidth
                  type="number"
                  label="Điểm Tối Thiểu"
                  value={web3FormData.min_test_score}
                  onChange={(e) => setWeb3FormData({ ...web3FormData, min_test_score: parseInt(e.target.value) })}
                  margin="normal"
                  inputProps={{ min: 0, max: 100 }}
                  helperText="Điểm tối thiểu để được tham gia phòng ban (0-100)"
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeb3DialogOpen(false)}>Hủy</Button>
          <Button onClick={handleCreateWeb3Department} variant="contained">
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Web3 Members Dialog */}
      <Dialog 
        open={web3MembersDialog} 
        onClose={() => setWeb3MembersDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Thành Viên - {selectedWeb3DepartmentMembers?.department?.department_name}
        </DialogTitle>
        <DialogContent>
          {selectedWeb3DepartmentMembers?.members && selectedWeb3DepartmentMembers.members.length > 0 ? (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee DID</TableCell>
                    <TableCell>Wallet Address</TableCell>
                    <TableCell>Phương Thức</TableCell>
                    <TableCell>Transaction</TableCell>
                    <TableCell>Ngày Tham Gia</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedWeb3DepartmentMembers.members.map((member) => (
                    <TableRow key={member._id || member.employee_did}>
                      <TableCell>{member.employee_did}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {member.wallet_address?.slice(0, 10)}...{member.wallet_address?.slice(-8)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={member.qualification_method === 'test' ? 'Test' : 'Voting'} 
                          size="small"
                          color={member.qualification_method === 'test' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>
                        {member.blockchain_tx_hash ? (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<OpenInNewIcon />}
                            href={`https://sepolia.etherscan.io/tx/${member.blockchain_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Xem TX
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Chưa có
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(member.joined_at).toLocaleDateString('vi-VN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Chưa có thành viên nào trong phòng ban này.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeb3MembersDialog(false)}>Đóng</Button>
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
};

export default DepartmentManagement;
