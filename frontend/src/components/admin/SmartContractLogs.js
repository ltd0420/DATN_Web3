import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, IconButton, Tooltip,
  Avatar, Divider, FormControl, InputLabel, Select, MenuItem,
  InputAdornment, Tabs, Tab, Dialog, DialogTitle, DialogContent,
  DialogActions, Link
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CalendarToday as CalendarTodayIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';

const SmartContractLogs = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data
  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    department_id: '',
    employee_did: '',
    function_name: '',
    status: '',
    start_date: '',
    end_date: '',
    search: ''
  });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Dialog
  const [selectedLog, setSelectedLog] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    totalAmount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadData = async () => {
    try {
      const [departmentsRes, employeesRes] = await Promise.all([
        apiService.getDepartments(),
        apiService.getEmployees()
      ]);
      setDepartments(departmentsRes || []);
      setEmployees(employeesRes || []);
    } catch (err) {
      console.error('Error loading departments/employees:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filters.department_id) params.department_id = filters.department_id;
      if (filters.employee_did) params.employee_did = filters.employee_did;
      if (filters.function_name) params.function_name = filters.function_name;
      if (filters.status) params.status = filters.status;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.search) params.search = filters.search;

      const response = await apiService.get('/logs/contracts', params);
      const logsData = response?.data?.data || response?.data || [];
      setLogs(Array.isArray(logsData) ? logsData : []);

      // Calculate stats
      const successCount = logsData.filter(log => log.status === 'Success').length;
      const failedCount = logsData.filter(log => log.status === 'Failed').length;
      const pendingCount = logsData.filter(log => log.status === 'Pending').length;
      
      // Calculate total amount from all payment transactions
      let totalAmount = 0;
      logsData.forEach(log => {
        const isPayment = log.function_name === 'paySalary' || 
                         log.function_name === 'payTaskReward' || 
                         log.function_name === 'payAttendance' ||
                         log.function_name === 'anchorAttendance';
        
        if (isPayment && log.status === 'Success') {
          // Try to get amount from different sources
          let amount = 0;
          
          // Priority 1: Check direct amount field (already in USDT, not wei)
          if (log.amount != null && log.amount !== undefined) {
            amount = typeof log.amount === 'string' 
              ? parseFloat(log.amount) 
              : log.amount;
          }
          // Priority 2: Check parameters.amount (in wei/token units, need to convert)
          else if (log.parameters?.amount) {
            const paramAmount = typeof log.parameters.amount === 'string' 
              ? parseFloat(log.parameters.amount) 
              : log.parameters.amount;
            // If it's a very large number (> 1e10), it's likely in wei
            amount = paramAmount > 1e10 ? paramAmount / 1e18 : paramAmount;
          }
          // Priority 3: Check parameters.rewardAmount
          else if (log.parameters?.rewardAmount) {
            const rewardAmount = typeof log.parameters.rewardAmount === 'string'
              ? parseFloat(log.parameters.rewardAmount)
              : log.parameters.rewardAmount;
            amount = rewardAmount > 1e10 ? rewardAmount / 1e18 : rewardAmount;
          }
          // Priority 4: Check parameters.salaryAmount
          else if (log.parameters?.salaryAmount) {
            const salaryAmount = typeof log.parameters.salaryAmount === 'string'
              ? parseFloat(log.parameters.salaryAmount)
              : log.parameters.salaryAmount;
            amount = salaryAmount > 1e10 ? salaryAmount / 1e18 : salaryAmount;
          }
          // Priority 5: Check event_logs for amount
          else if (log.event_logs && log.event_logs.length > 0) {
            for (const event of log.event_logs) {
              if (event.data?.amount != null) {
                const eventAmount = typeof event.data.amount === 'string'
                  ? parseFloat(event.data.amount)
                  : event.data.amount;
                amount = eventAmount > 1e10 ? eventAmount / 1e18 : eventAmount;
                break;
              }
              if (event.data?.rewardAmount != null) {
                const rewardAmount = typeof event.data.rewardAmount === 'string'
                  ? parseFloat(event.data.rewardAmount)
                  : event.data.rewardAmount;
                amount = rewardAmount > 1e10 ? rewardAmount / 1e18 : rewardAmount;
                break;
              }
              if (event.data?.salaryAmount != null) {
                const salaryAmount = typeof event.data.salaryAmount === 'string'
                  ? parseFloat(event.data.salaryAmount)
                  : event.data.salaryAmount;
                amount = salaryAmount > 1e10 ? salaryAmount / 1e18 : salaryAmount;
                break;
              }
            }
          }
          
          totalAmount += amount;
        }
      });

      setStats({
        total: logsData.length,
        success: successCount,
        failed: failedCount,
        pending: pendingCount,
        totalAmount: totalAmount
      });
    } catch (err) {
      console.error('Error loading smart contract logs:', err);
      setError(err.response?.data?.message || err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const formatAddress = (address) => {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return `${Math.floor(diffDays / 30)} tháng trước`;
  };

  const formatAmount = (amount, decimals = 18) => {
    if (!amount) return '0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const tokens = num / Math.pow(10, decimals);
    return tokens.toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Success':
        return 'success';
      case 'Failed':
        return 'error';
      case 'Pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Success':
        return <CheckCircleIcon fontSize="small" />;
      case 'Failed':
        return <CancelIcon fontSize="small" />;
      case 'Pending':
        return <PendingIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getFunctionNameLabel = (functionName) => {
    const labels = {
      'paySalary': 'Thanh toán Lương',
      'payTaskReward': 'Thưởng Công việc',
      'payAttendance': 'Thanh toán Chấm công',
      'anchorAttendance': 'Thanh toán Chấm công',
      'deposit': 'Nạp tiền',
      'withdraw': 'Rút tiền'
    };
    return labels[functionName] || functionName;
  };

  // Filter logs by department
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Filter by department (if log has employee_did, check employee's department)
    if (filters.department_id) {
      const departmentEmployees = employees
        .filter(emp => emp.phong_ban_id === filters.department_id)
        .map(emp => emp.employee_did);
      
      filtered = filtered.filter(log => {
        const employeeDid = log.parameters?.employeeDid || log.parameters?.employee_did;
        return departmentEmployees.includes(employeeDid);
      });
    }

    // Filter by employee
    if (filters.employee_did) {
      filtered = filtered.filter(log => {
        const employeeDid = log.parameters?.employeeDid || log.parameters?.employee_did;
        return employeeDid === filters.employee_did;
      });
    }

    // Filter by function name
    if (filters.function_name) {
      filtered = filtered.filter(log => log.function_name === filters.function_name);
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(log => log.status === filters.status);
    }

    // Filter by date range
    if (filters.start_date) {
      const startDate = new Date(filters.start_date);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(log => new Date(log.timestamp) >= startDate);
    }

    if (filters.end_date) {
      const endDate = new Date(filters.end_date);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.timestamp) <= endDate);
    }

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log => {
        return (
          log.transaction_hash?.toLowerCase().includes(searchLower) ||
          log.function_name?.toLowerCase().includes(searchLower) ||
          log.parameters?.employeeDid?.toLowerCase().includes(searchLower) ||
          log.parameters?.employee_did?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [logs, filters, employees]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredLogs.slice(start, end);
  }, [filteredLogs, page, rowsPerPage]);

  const getEmployeeName = (employeeDid) => {
    if (!employeeDid) return '-';
    const employee = employees.find(emp => emp.employee_did === employeeDid);
    return employee?.ho_ten || employee?.ten_nhan_vien || formatAddress(employeeDid);
  };

  const getEmployeeDepartment = (employeeDid) => {
    if (!employeeDid) return '-';
    const employee = employees.find(emp => emp.employee_did === employeeDid);
    if (!employee?.phong_ban_id) return '-';
    const department = departments.find(dept => dept.phong_ban_id === employee.phong_ban_id);
    return department?.ten_phong_ban || '-';
  };

  const getEtherscanUrl = (txHash) => {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Smart Contract Logs
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadLogs}
          disabled={loading}
        >
          Làm mới
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Tổng giao dịch
              </Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Thành công
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.success}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Thất bại
              </Typography>
              <Typography variant="h4" color="error.main">
                {stats.failed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Đang chờ
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Tổng số tiền
              </Typography>
              <Typography variant="h4" color="primary.main">
                {stats.totalAmount.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TUSD
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Phòng ban</InputLabel>
                <Select
                  value={filters.department_id}
                  label="Phòng ban"
                  onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  {departments.map((dept) => (
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
                  value={filters.employee_did}
                  label="Nhân viên"
                  onChange={(e) => setFilters({ ...filters, employee_did: e.target.value })}
                  disabled={!filters.department_id}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  {employees
                    .filter(emp => !filters.department_id || emp.phong_ban_id === filters.department_id)
                    .map((emp) => (
                      <MenuItem key={emp.employee_did} value={emp.employee_did}>
                        {emp.ho_ten || emp.ten_nhan_vien || emp.employee_did}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Loại giao dịch</InputLabel>
                <Select
                  value={filters.function_name}
                  label="Loại giao dịch"
                  onChange={(e) => setFilters({ ...filters, function_name: e.target.value })}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  <MenuItem value="paySalary">Thanh toán Lương</MenuItem>
                  <MenuItem value="payTaskReward">Thưởng Công việc</MenuItem>
                  <MenuItem value="payAttendance">Thanh toán Chấm công</MenuItem>
                  <MenuItem value="deposit">Nạp tiền</MenuItem>
                  <MenuItem value="withdraw">Rút tiền</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Trạng thái</InputLabel>
                <Select
                  value={filters.status}
                  label="Trạng thái"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  <MenuItem value="Success">Thành công</MenuItem>
                  <MenuItem value="Failed">Thất bại</MenuItem>
                  <MenuItem value="Pending">Đang chờ</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Tìm kiếm"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Từ ngày"
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Đến ngày"
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setFilters({
                  department_id: '',
                  employee_did: '',
                  function_name: '',
                  status: '',
                  start_date: '',
                  end_date: '',
                  search: ''
                })}
              >
                Xóa bộ lọc
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Logs Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Lịch sử giao dịch ({filteredLogs.length} giao dịch)
            </Typography>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : filteredLogs.length === 0 ? (
            <Alert severity="info">Không có giao dịch nào</Alert>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Thời gian</TableCell>
                      <TableCell>Loại giao dịch</TableCell>
                      <TableCell>Nhân viên</TableCell>
                      <TableCell>Phòng ban</TableCell>
                      <TableCell align="right">Số tiền</TableCell>
                      <TableCell align="center">Trạng thái</TableCell>
                      <TableCell>Transaction Hash</TableCell>
                      <TableCell align="center">Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedLogs.map((log) => {
                      const employeeDid = log.parameters?.employeeDid || log.parameters?.employee_did;
                      const isPayment = log.function_name === 'paySalary' || 
                                       log.function_name === 'payTaskReward' || 
                                       log.function_name === 'payAttendance' ||
                                       log.function_name === 'anchorAttendance';
                      
                      // Get amount from multiple sources
                      let amount = null;
                      if (isPayment) {
                        // Priority 1: Check direct amount field (this is already in USDT, not wei)
                        if (log.amount != null && log.amount !== undefined) {
                          // amount field is already in USDT (real amount), not wei
                          amount = typeof log.amount === 'string' 
                            ? parseFloat(log.amount) 
                            : log.amount;
                        }
                        // Priority 2: Check parameters.amount (this is in wei/token units, need to convert)
                        else if (log.parameters?.amount) {
                          // parameters.amount is in wei/token units (string), need to divide by 1e18
                          amount = typeof log.parameters.amount === 'string' 
                            ? parseFloat(log.parameters.amount) / 1e18
                            : log.parameters.amount / 1e18;
                        }
                        // Priority 3: Check parameters.rewardAmount (for payTaskReward)
                        else if (log.parameters?.rewardAmount) {
                          // Check if it's already in USDT or in wei
                          const rewardAmount = typeof log.parameters.rewardAmount === 'string' 
                            ? parseFloat(log.parameters.rewardAmount) 
                            : log.parameters.rewardAmount;
                          // If it's a very large number (> 1e10), it's likely in wei
                          amount = rewardAmount > 1e10 ? rewardAmount / 1e18 : rewardAmount;
                        }
                        // Priority 4: Check parameters.salaryAmount (for paySalary)
                        else if (log.parameters?.salaryAmount) {
                          const salaryAmount = typeof log.parameters.salaryAmount === 'string' 
                            ? parseFloat(log.parameters.salaryAmount) 
                            : log.parameters.salaryAmount;
                          amount = salaryAmount > 1e10 ? salaryAmount / 1e18 : salaryAmount;
                        }
                        // Priority 5: Check event_logs for amount
                        else if (log.event_logs && log.event_logs.length > 0) {
                          for (const event of log.event_logs) {
                            // Check event.data.amount
                            if (event.data?.amount != null) {
                              const eventAmount = typeof event.data.amount === 'string' 
                                ? parseFloat(event.data.amount) 
                                : event.data.amount;
                              // If it's a very large number, it's likely in wei
                              amount = eventAmount > 1e10 ? eventAmount / 1e18 : eventAmount;
                              break;
                            }
                            // Check event.data.rewardAmount
                            if (event.data?.rewardAmount != null) {
                              const rewardAmount = typeof event.data.rewardAmount === 'string' 
                                ? parseFloat(event.data.rewardAmount) 
                                : event.data.rewardAmount;
                              amount = rewardAmount > 1e10 ? rewardAmount / 1e18 : rewardAmount;
                              break;
                            }
                            // Check event.data.salaryAmount
                            if (event.data?.salaryAmount != null) {
                              const salaryAmount = typeof event.data.salaryAmount === 'string' 
                                ? parseFloat(event.data.salaryAmount) 
                                : event.data.salaryAmount;
                              amount = salaryAmount > 1e10 ? salaryAmount / 1e18 : salaryAmount;
                              break;
                            }
                            // For SalaryPaid event, amount is usually in the event args
                            if (event.event_name === 'SalaryPaid' && event.data) {
                              const eventData = event.data;
                              if (eventData.amount != null) {
                                const eventAmount = typeof eventData.amount === 'string' 
                                  ? parseFloat(eventData.amount) 
                                  : eventData.amount;
                                amount = eventAmount > 1e10 ? eventAmount / 1e18 : eventAmount;
                                break;
                              }
                              // Sometimes it's in args array
                              if (eventData.args && Array.isArray(eventData.args)) {
                                const amountArg = eventData.args.find(arg => 
                                  typeof arg === 'object' && arg !== null && 'amount' in arg
                                );
                                if (amountArg) {
                                  const eventAmount = typeof amountArg.amount === 'string' 
                                    ? parseFloat(amountArg.amount) 
                                    : amountArg.amount;
                                  amount = eventAmount > 1e10 ? eventAmount / 1e18 : eventAmount;
                                  break;
                                }
                              }
                            }
                          }
                        }
                      }

                      return (
                        <TableRow key={log._id || log.transaction_hash} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">
                                {formatDateTime(log.timestamp)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatTimeAgo(log.timestamp)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getFunctionNameLabel(log.function_name)}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {employeeDid ? (
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar sx={{ width: 24, height: 24 }}>
                                  {getEmployeeName(employeeDid).charAt(0)}
                                </Avatar>
                                <Typography variant="body2">
                                  {getEmployeeName(employeeDid)}
                                </Typography>
                              </Box>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {employeeDid ? (
                              <Typography variant="body2">
                                {getEmployeeDepartment(employeeDid)}
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {isPayment && amount != null ? (
                              <Typography variant="body2" fontWeight="bold" color="success.main">
                                {amount.toLocaleString('vi-VN', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 6 
                                })} TUSD
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              icon={getStatusIcon(log.status)}
                              label={log.status}
                              size="small"
                              color={getStatusColor(log.status)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {formatAddress(log.transaction_hash)}
                              </Typography>
                              <Tooltip title="Xem trên Etherscan">
                                <IconButton
                                  size="small"
                                  href={getEtherscanUrl(log.transaction_hash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <OpenInNewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Xem chi tiết">
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(log)}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Hiển thị {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, filteredLogs.length)} / {filteredLogs.length}
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                  >
                    Đầu
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Trước
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setPage(p => Math.min(Math.ceil(filteredLogs.length / rowsPerPage) - 1, p + 1))}
                    disabled={page >= Math.ceil(filteredLogs.length / rowsPerPage) - 1}
                  >
                    Sau
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setPage(Math.ceil(filteredLogs.length / rowsPerPage) - 1)}
                    disabled={page >= Math.ceil(filteredLogs.length / rowsPerPage) - 1}
                  >
                    Cuối
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết Giao dịch</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Transaction Hash</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {selectedLog.transaction_hash}
                </Typography>
                <Link
                  href={getEtherscanUrl(selectedLog.transaction_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mt: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  Xem trên Etherscan <OpenInNewIcon fontSize="small" />
                </Link>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Block Number</Typography>
                <Typography variant="body1">{selectedLog.block_number || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Contract Address</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {formatAddress(selectedLog.contract_address)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Function Name</Typography>
                <Typography variant="body1">{getFunctionNameLabel(selectedLog.function_name)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Trạng thái</Typography>
                <Chip
                  icon={getStatusIcon(selectedLog.status)}
                  label={selectedLog.status}
                  size="small"
                  color={getStatusColor(selectedLog.status)}
                />
              </Grid>
              {(() => {
                const isPayment = selectedLog.function_name === 'paySalary' || 
                                 selectedLog.function_name === 'payTaskReward' || 
                                 selectedLog.function_name === 'payAttendance' ||
                                 selectedLog.function_name === 'anchorAttendance';
                let amount = null;
                if (isPayment) {
                  // Priority 1: Check direct amount field (already in USDT)
                  if (selectedLog.amount != null && selectedLog.amount !== undefined) {
                    amount = typeof selectedLog.amount === 'string' 
                      ? parseFloat(selectedLog.amount) 
                      : selectedLog.amount;
                  }
                  // Priority 2: Check parameters.amount (in wei, need to convert)
                  else if (selectedLog.parameters?.amount) {
                    const paramAmount = typeof selectedLog.parameters.amount === 'string' 
                      ? parseFloat(selectedLog.parameters.amount) 
                      : selectedLog.parameters.amount;
                    amount = paramAmount > 1e10 ? paramAmount / 1e18 : paramAmount;
                  }
                  // Priority 3: Check parameters.rewardAmount
                  else if (selectedLog.parameters?.rewardAmount) {
                    const rewardAmount = typeof selectedLog.parameters.rewardAmount === 'string'
                      ? parseFloat(selectedLog.parameters.rewardAmount)
                      : selectedLog.parameters.rewardAmount;
                    amount = rewardAmount > 1e10 ? rewardAmount / 1e18 : rewardAmount;
                  }
                  // Priority 4: Check parameters.salaryAmount
                  else if (selectedLog.parameters?.salaryAmount) {
                    const salaryAmount = typeof selectedLog.parameters.salaryAmount === 'string'
                      ? parseFloat(selectedLog.parameters.salaryAmount)
                      : selectedLog.parameters.salaryAmount;
                    amount = salaryAmount > 1e10 ? salaryAmount / 1e18 : salaryAmount;
                  }
                  // Priority 5: Check event_logs
                  else if (selectedLog.event_logs && selectedLog.event_logs.length > 0) {
                    for (const event of selectedLog.event_logs) {
                      if (event.data?.amount != null) {
                        const eventAmount = typeof event.data.amount === 'string'
                          ? parseFloat(event.data.amount)
                          : event.data.amount;
                        amount = eventAmount > 1e10 ? eventAmount / 1e18 : eventAmount;
                        break;
                      }
                      if (event.data?.rewardAmount != null) {
                        const rewardAmount = typeof event.data.rewardAmount === 'string'
                          ? parseFloat(event.data.rewardAmount)
                          : event.data.rewardAmount;
                        amount = rewardAmount > 1e10 ? rewardAmount / 1e18 : rewardAmount;
                        break;
                      }
                      if (event.data?.salaryAmount != null) {
                        const salaryAmount = typeof event.data.salaryAmount === 'string'
                          ? parseFloat(event.data.salaryAmount)
                          : event.data.salaryAmount;
                        amount = salaryAmount > 1e10 ? salaryAmount / 1e18 : salaryAmount;
                        break;
                      }
                    }
                  }
                }
                return amount != null ? (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Số tiền</Typography>
                    <Typography variant="body1" fontWeight="bold" color="success.main">
                      {amount.toLocaleString('vi-VN', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 6 
                      })} TUSD
                    </Typography>
                  </Grid>
                ) : null;
              })()}
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Thời gian</Typography>
                <Typography variant="body1">{formatDateTime(selectedLog.timestamp)}</Typography>
              </Grid>
              {selectedLog.gas_used && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Gas Used</Typography>
                  <Typography variant="body1">{selectedLog.gas_used.toLocaleString()}</Typography>
                </Grid>
              )}
              {selectedLog.parameters && Object.keys(selectedLog.parameters).length > 0 && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>Parameters</Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(selectedLog.parameters, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                </>
              )}
              {selectedLog.event_logs && selectedLog.event_logs.length > 0 && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>Event Logs</Typography>
                    {selectedLog.event_logs.map((event, index) => (
                      <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                        <Typography variant="subtitle2" gutterBottom>{event.event_name}</Typography>
                        <pre style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </Paper>
                    ))}
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SmartContractLogs;
