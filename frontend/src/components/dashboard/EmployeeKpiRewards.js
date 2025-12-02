import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  CircularProgress, Alert, IconButton, Tooltip, useTheme, Divider
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Error as ErrorIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import { format } from 'date-fns';

function EmployeeKpiRewards({ user, employeeData, onDataUpdate }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpiData, setKpiData] = useState(null);

  useEffect(() => {
    if (user?.employee_did) {
      loadKpiRewards();
    }
  }, [user?.employee_did]);

  const loadKpiRewards = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getEmployeeKpiRewards(user.employee_did);
      if (response.success) {
        setKpiData(response.data);
      } else {
        setError(response.message || 'Không thể tải thông tin KPI thưởng');
      }
    } catch (err) {
      console.error('Error loading KPI rewards:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải thông tin KPI thưởng');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'N/A';
    }
  };

  const getPaymentStatusChip = (status, transactionHash) => {
    if (!transactionHash) {
      return <Chip label="Chưa thanh toán" size="small" color="default" icon={<PendingIcon />} />;
    }
    
    switch (status) {
      case 'completed':
        return <Chip label="Đã thanh toán" size="small" color="success" icon={<CheckCircleIcon />} />;
      case 'pending':
        return <Chip label="Đang xử lý" size="small" color="warning" icon={<PendingIcon />} />;
      case 'failed':
        return <Chip label="Thất bại" size="small" color="error" icon={<ErrorIcon />} />;
      default:
        return <Chip label="Đã thanh toán" size="small" color="success" icon={<CheckCircleIcon />} />;
    }
  };

  const openTransactionInExplorer = (transactionHash) => {
    const explorerUrl = process.env.REACT_APP_BLOCKCHAIN_EXPLORER || 'https://sepolia.etherscan.io';
    window.open(`${explorerUrl}/tx/${transactionHash}`, '_blank');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Box mt={2}>
          <IconButton onClick={loadKpiRewards} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Alert>
    );
  }

  if (!kpiData) {
    return (
      <Alert severity="info">
        Không có dữ liệu KPI thưởng
      </Alert>
    );
  }

  const { summary, tasks } = kpiData;

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          KPI Thưởng
        </Typography>
        <IconButton onClick={loadKpiRewards} color="primary">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <MoneyIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng Thưởng
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {formatCurrency(summary.totalReward)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ 
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Thực Nhận
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary.main">
                    {formatCurrency(summary.netReward)}
                  </Typography>
                </Box>
              </Box>
              {summary.totalPenalty > 0 && (
                <Typography variant="caption" color="error">
                  (Đã trừ phạt: {formatCurrency(summary.totalPenalty)})
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ 
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <AssignmentIcon color="info" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Số Task Đã Thưởng
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {summary.totalTasks}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary.paidTasksCount} đã thanh toán • {summary.pendingTasksCount} chờ thanh toán
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tasks Table */}
      <Card sx={{ 
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`
      }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Chi tiết KPI Thưởng từ Công việc
          </Typography>
          
          {tasks.length === 0 ? (
            <Alert severity="info">
              Bạn chưa có công việc nào được thưởng KPI
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Công việc</strong></TableCell>
                    <TableCell align="right"><strong>Thưởng</strong></TableCell>
                    <TableCell><strong>Trạng thái</strong></TableCell>
                    <TableCell><strong>Ngày hoàn thành</strong></TableCell>
                    <TableCell><strong>Giao dịch</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.task_id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {task.ten_cong_viec}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {task.tien_thuong > 0 && (
                          <Chip
                            label={`+${formatCurrency(task.tien_thuong)}`}
                            size="small"
                            color="success"
                            icon={<TrendingUpIcon />}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusChip(task.payment_status, task.payment_transaction_hash)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(task.ngay_hoan_thanh_thuc_te)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {task.payment_transaction_hash ? (
                          <Tooltip title="Xem trên Etherscan">
                            <IconButton
                              size="small"
                              onClick={() => openTransactionInExplorer(task.payment_transaction_hash)}
                              color="primary"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default EmployeeKpiRewards;

