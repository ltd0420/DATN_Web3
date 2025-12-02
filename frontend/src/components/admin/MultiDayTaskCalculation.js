import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, IconButton, Tooltip,
  Avatar, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  Checkbox, FormControlLabel
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon,
  AutoAwesome as AutoAwesomeIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarTodayIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';

const MultiDayTaskCalculation = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Tasks data
  const [tasks, setTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    employee_did: '',
    trang_thai: '',
    start_date: '',
    end_date: ''
  });

  // Calculation result
  const [calculationResult, setCalculationResult] = useState(null); // For bulk calculation
  const [singleTaskResult, setSingleTaskResult] = useState(null); // For single task calculation
  const [calculatingTaskId, setCalculatingTaskId] = useState(null);

  // Average completion rate calculation
  const [averageCalculationForm, setAverageCalculationForm] = useState({
    employee_did: '',
    start_date: '',
    end_date: ''
  });
  const [averageCalculationResult, setAverageCalculationResult] = useState(null);
  const [calculatingAverage, setCalculatingAverage] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState(null);

  // Load tasks on mount and when filters change
  useEffect(() => {
    loadTasks();
  }, [filters]);

  // Debug: Log khi calculationResult thay đổi
  useEffect(() => {
    if (calculationResult) {
      console.log('calculationResult changed:', calculationResult);
      console.log('Has results?', !!calculationResult.results);
      console.log('Results:', calculationResult.results);
    }
  }, [calculationResult]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filters.employee_did) params.employee_did = filters.employee_did;
      if (filters.trang_thai) params.trang_thai = filters.trang_thai;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const result = await apiService.getMultiDayTasks(params);
      setTasks(result.tasks || []);
    } catch (err) {
      console.error('Error loading multi-day tasks:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải danh sách task');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSingle = async (taskId, autoPay = true) => {
    try {
      setCalculatingTaskId(taskId);
      setError(null);
      setSuccess(null);
      setSingleTaskResult(null);

      const result = await apiService.calculateMultiDayTaskKpi(taskId, autoPay);

      if (result.success) {
        const kpiAmount = result.kpi_amount || 0;
        const paymentStatus = result.payment_result?.success ? ' và đã thanh toán' : '';
        setSuccess(`Đã tính KPI cho task: ${formatCurrency(kpiAmount)}${paymentStatus}`);
        // Reload tasks to update status
        await loadTasks();
      } else {
        setError(result.message || 'Tính KPI thất bại');
      }

      setSingleTaskResult(result);
    } catch (err) {
      console.error('Error calculating KPI:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tính KPI');
    } finally {
      setCalculatingTaskId(null);
    }
  };

  const handleBulkCalculate = async () => {
    if (selectedTasks.length === 0) {
      setError('Vui lòng chọn ít nhất một task');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setCalculationResult(null);

      const taskIds = selectedTasks.map(t => t.task_id);
      console.log('Calculating KPI for tasks:', taskIds);
      
      const result = await apiService.bulkCalculateMultiDayTaskKpi(taskIds, true);
      console.log('Bulk calculate result:', result);
      console.log('Result type:', typeof result);
      console.log('Result keys:', result ? Object.keys(result) : 'null');

      // Kiểm tra nhiều format response có thể có
      if (result && (result.success === true || result.data?.success === true || result.success_count !== undefined)) {
        const data = result.data || result;
        console.log('Setting calculationResult with data:', data);
        console.log('Data has results?', !!data.results);
        console.log('Results length:', data.results?.length);
        
        const successCount = data.success_count || 0;
        const totalKpi = data.total_kpi || 0;
        const errorCount = data.error_count || 0;
        
        // Đếm số task đã thanh toán thành công
        const paidCount = data.results?.filter(r => r.payment_result?.success).length || 0;
        
        let message = `Đã tính KPI cho ${successCount} task`;
        if (totalKpi > 0) {
          message += `, Tổng: ${formatCurrency(totalKpi)}`;
        }
        if (paidCount > 0) {
          message += `, ${paidCount} task đã thanh toán thành công`;
        }
        if (errorCount > 0) {
          message += `, ${errorCount} task lỗi`;
        }
        
        setSuccess(message);
        setCalculationResult(data);
        setSelectedTasks([]);
        // Reload tasks để cập nhật trạng thái
        await loadTasks();
      } else {
        // Hiển thị lỗi chi tiết hơn
        const errorMsg = result?.message || result?.error || result?.data?.message || 'Tính KPI thất bại';
        const errorDetails = result?.errors ? `\nChi tiết: ${JSON.stringify(result.errors)}` : '';
        setError(errorMsg + errorDetails);
        console.error('Bulk calculate failed:', result);
      }
    } catch (err) {
      console.error('Error bulk calculating KPI:', err);
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          err.message || 
                          'Lỗi khi tính KPI';
      const errorDetails = err.response?.data?.errors ? 
                          `\nChi tiết: ${JSON.stringify(err.response.data.errors)}` : '';
      setError(errorMessage + errorDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTask = (task) => {
    const isSelected = selectedTasks.some(t => t.task_id === task.task_id);
    if (isSelected) {
      setSelectedTasks(selectedTasks.filter(t => t.task_id !== task.task_id));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks([...tasks]);
    }
  };

  const handleOpenDialog = (task) => {
    setDialogTask(task);
    setDialogOpen(true);
  };

  const handleCalculateAverage = async () => {
    if (!averageCalculationForm.employee_did || !averageCalculationForm.start_date || !averageCalculationForm.end_date) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setCalculatingAverage(true);
      setError(null);
      setSuccess(null);
      setAverageCalculationResult(null);

      const result = await apiService.calculateAverageCompletionRate(
        averageCalculationForm.employee_did,
        averageCalculationForm.start_date,
        averageCalculationForm.end_date,
        true // auto_pay
      );

      if (result.success) {
        setAverageCalculationResult(result.data);
        const message = `Đã tính tỷ lệ hoàn thành trung bình: ${result.data.average_completion_rate?.toFixed(2)}%, Tổng KPI: ${formatCurrency(result.data.total_kpi || 0)}`;
        if (result.data.payment_result?.success) {
          setSuccess(message + ` - Đã thanh toán thành công`);
        } else {
          setSuccess(message);
        }
      } else {
        setError(result.message || 'Tính tỷ lệ hoàn thành trung bình thất bại');
      }
    } catch (err) {
      console.error('Error calculating average completion rate:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tính tỷ lệ hoàn thành trung bình');
    } finally {
      setCalculatingAverage(false);
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

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Hoàn thành':
        return 'success';
      case 'Đang thực hiện':
        return 'info';
      case 'Chưa bắt đầu':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Quy tắc tính KPI cho Task Nhiều Ngày (≥ 2 ngày):</strong>
        </Typography>
        <Typography variant="body2" component="div" sx={{ mt: 1 }}>
          • <strong>Deadline:</strong> Lấy ngày trong trường <strong>ngay_ket_thuc_du_kien</strong> và đặt giờ là <strong>20:00:00 (8PM)</strong>
          <br />
          • <strong>Hoàn thành đúng hạn (≤ 20:00 của deadline):</strong> KPI = (Tiến độ / 100) × Tổng giờ làm thực tế × 2 USDT
          <br />
          • <strong>Hoàn thành trễ hạn (&gt; 20:00 của deadline):</strong> KPI = (Tiến độ × 0.5 / 100) × Tổng giờ làm thực tế × 2 USDT
          <br />
          • <strong>Chưa được admin duyệt:</strong> KPI = 0
          <br />
          • <strong>Tổng giờ làm thực tế:</strong> Tính từ <strong>ngay_bat_dau</strong> đến <strong>ngay_hoan_thanh_thuc_te</strong> (nếu trễ, chỉ tính đến 20:00 của ngày deadline)
          <br />
          • <strong>Thanh toán:</strong> Chỉ thanh toán MỘT LẦN duy nhất khi công việc được Admin duyệt (trạng thái "Hoàn thành")
        </Typography>
      </Alert>

      {/* Calculate Average Completion Rate Section */}
      <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
            Tính Tỷ Lệ Hoàn Thành Trung Bình (Kỳ)
          </Typography>
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
            <Typography variant="body2">
              Tính tỷ lệ hoàn thành trung bình cho nhiều công việc nhiều ngày trong một kỳ. 
              Hệ thống sẽ tự động tính KPI tổng và thanh toán qua Smart Contract.
            </Typography>
          </Alert>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="ID Nhân viên"
                value={averageCalculationForm.employee_did}
                onChange={(e) => setAverageCalculationForm({ ...averageCalculationForm, employee_did: e.target.value })}
                size="small"
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Từ ngày"
                type="date"
                value={averageCalculationForm.start_date}
                onChange={(e) => setAverageCalculationForm({ ...averageCalculationForm, start_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Đến ngày"
                type="date"
                value={averageCalculationForm.end_date}
                onChange={(e) => setAverageCalculationForm({ ...averageCalculationForm, end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CalculateIcon />}
                onClick={handleCalculateAverage}
                fullWidth
                disabled={calculatingAverage}
                sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
              >
                {calculatingAverage ? 'Đang tính...' : 'Tính KPI'}
              </Button>
            </Grid>
          </Grid>

          {averageCalculationResult && (
            <Box sx={{ mt: 3, bgcolor: 'rgba(255, 255, 255, 0.1)', p: 2, borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Kết quả tính toán
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Tổng công việc</Typography>
                  <Typography variant="h6">{averageCalculationResult.total_tasks || 0}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Đã duyệt</Typography>
                  <Typography variant="h6" color="success.main">{averageCalculationResult.approved_tasks || 0}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Tỷ lệ trung bình</Typography>
                  <Typography variant="h6">{averageCalculationResult.average_completion_rate?.toFixed(2) || '0.00'}%</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">Tổng KPI</Typography>
                  <Typography variant="h6" color="primary">{formatCurrency(averageCalculationResult.total_kpi || 0)}</Typography>
                </Grid>
              </Grid>
              {averageCalculationResult.payment_result?.success && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Thanh toán thành công!</strong> Transaction: {averageCalculationResult.payment_result.transactionHash}
                  </Typography>
                  <IconButton
                    size="small"
                    href={`https://sepolia.etherscan.io/tx/${averageCalculationResult.payment_result.transactionHash}`}
                    target="_blank"
                    sx={{ mt: 1 }}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedTasks.length > 0 && (
        <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Đã chọn {selectedTasks.length} task
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleBulkCalculate}
                disabled={loading}
              >
                Tính KPI cho {selectedTasks.length} task
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          <Typography variant="body1" fontWeight="bold" gutterBottom>
            {error.split('\n')[0]}
          </Typography>
          {error.includes('\n') && (
            <Typography variant="body2" component="pre" sx={{ mt: 1, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {error.split('\n').slice(1).join('\n')}
            </Typography>
          )}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Bulk Calculation Results - Hiển thị khi có calculationResult */}
      {calculationResult && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
              Kết quả tính KPI
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Tổng task
                    </Typography>
                    <Typography variant="h4">
                      {calculationResult.total_tasks || calculationResult.results.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Thành công
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {calculationResult.success_count || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Lỗi
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {calculationResult.error_count || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Tổng KPI
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {formatCurrency(calculationResult.total_kpi || 0)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>
              Danh sách task đã tính KPI
            </Typography>
            {calculationResult.results && calculationResult.results.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Task</TableCell>
                      <TableCell align="right">Tiến độ</TableCell>
                      <TableCell align="right">Giờ thực tế</TableCell>
                      <TableCell align="right">KPI (USDT)</TableCell>
                      <TableCell align="center">Thanh toán</TableCell>
                      <TableCell align="center">Transaction</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {calculationResult.results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {result.task_name || result.task_id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {result.task_id}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {result.final_percent?.toFixed(2) || result.tien_do_goc?.toFixed(2) || '0.00'}%
                      </TableCell>
                      <TableCell align="right">
                        {result.total_hours?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(result.kpi_amount || 0)}</strong>
                      </TableCell>
                      <TableCell align="center">
                        {result.payment_result?.success ? (
                          <Chip icon={<CheckCircleIcon />} label="Thành công" color="success" size="small" />
                        ) : result.payment_result ? (
                          <Chip icon={<CancelIcon />} label="Thất bại" color="error" size="small" />
                        ) : (
                          <Chip label="Chưa thanh toán" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {result.payment_result?.success && result.payment_result?.transactionHash ? (
                          <Tooltip title="Xem trên Etherscan">
                            <IconButton
                              size="small"
                              href={`https://sepolia.etherscan.io/tx/${result.payment_result.transactionHash}`}
                              target="_blank"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                Không có kết quả chi tiết để hiển thị
              </Alert>
            )}

            {calculationResult.errors && calculationResult.errors.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom color="error">
                  Danh sách lỗi
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Task</TableCell>
                        <TableCell>Lỗi</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {calculationResult.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.task_id || error.task_name || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip label={error.error || error.message} color="error" size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tasks Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Danh sách Task Nhiều Ngày ({tasks.length} task)
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedTasks.length === tasks.length && tasks.length > 0}
                  indeterminate={selectedTasks.length > 0 && selectedTasks.length < tasks.length}
                  onChange={handleSelectAll}
                />
              }
              label="Chọn tất cả"
            />
          </Box>

          {loading && tasks.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : tasks.length === 0 ? (
            <Alert severity="info">Không có task nhiều ngày nào</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        indeterminate={selectedTasks.length > 0 && selectedTasks.length < tasks.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Task</TableCell>
                    <TableCell>Nhân viên</TableCell>
                    <TableCell align="center">Số ngày</TableCell>
                    <TableCell>Ngày bắt đầu</TableCell>
                    <TableCell>Deadline</TableCell>
                    <TableCell align="center">Tiến độ</TableCell>
                    <TableCell align="center">Giờ thực tế</TableCell>
                    <TableCell align="center">Trạng thái</TableCell>
                    <TableCell align="center">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => {
                    const isSelected = selectedTasks.some(t => t.task_id === task.task_id);
                    const isCalculating = calculatingTaskId === task.task_id;
                    const isCompleted = task.trang_thai === 'Hoàn thành';
                    const isBeforeDeadline = task.is_completed_before_deadline;

                    return (
                      <TableRow key={task.task_id} selected={isSelected}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectTask(task)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {task.ten_cong_viec}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {task.task_id}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ mr: 1, width: 32, height: 32 }}>
                              {task.employee_name?.charAt(0) || task.nguoi_thuc_hien_did?.charAt(0) || 'N'}
                            </Avatar>
                            <Box>
                              {task.employee_name && (
                                <Typography variant="body2" fontWeight="bold">
                                  {task.employee_name}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {task.nguoi_thuc_hien_did}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${task.days_duration} ngày`}
                            size="small"
                            color="info"
                            icon={<CalendarTodayIcon />}
                          />
                        </TableCell>
                        <TableCell>
                          {formatDateTime(task.ngay_bat_dau)}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {formatDateTime(task.deadline)}
                            </Typography>
                            {isCompleted && (
                              <Chip
                                label={isBeforeDeadline ? 'Đúng hạn' : 'Trễ hạn'}
                                size="small"
                                color={isBeforeDeadline ? 'success' : 'warning'}
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold">
                            {task.tien_do || 0}%
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {task.gio_thuc_te || 0}h
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={task.trang_thai}
                            size="small"
                            color={getStatusColor(task.trang_thai)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            <Tooltip title="Xem chi tiết">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(task)}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isCompleted && (
                              <Tooltip title="Tính KPI">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleCalculateSingle(task.task_id, true)}
                                    disabled={isCalculating}
                                  >
                                    {isCalculating ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <CalculateIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Calculation Result Dialog - Only for single task calculation */}
      {singleTaskResult && (
        <Dialog 
          open={!!singleTaskResult} 
          onClose={() => {
            setSingleTaskResult(null);
            // Remove focus from any button to prevent aria-hidden warning
            setTimeout(() => {
              if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
              }
            }, 0);
          }} 
          maxWidth="md" 
          fullWidth
          disableEnforceFocus={false}
          disableRestoreFocus={false}
        >
          <DialogTitle>Kết quả tính KPI</DialogTitle>
          <DialogContent>
            {singleTaskResult.success ? (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  {singleTaskResult.message}
                </Alert>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Task ID</Typography>
                    <Typography variant="body1">{singleTaskResult.task_id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Nhân viên</Typography>
                    <Typography variant="body1">{singleTaskResult.employee_name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Tiến độ gốc</Typography>
                    <Typography variant="body1">{singleTaskResult.tien_do_goc}%</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Tiến độ sau điều chỉnh</Typography>
                    <Typography variant="body1" fontWeight="bold">{singleTaskResult.final_percent}%</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Tổng giờ làm</Typography>
                    <Typography variant="body1">{singleTaskResult.total_hours}h</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">KPI</Typography>
                    <Typography variant="h6" color="primary">{formatCurrency(singleTaskResult.kpi_amount)}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Deadline</Typography>
                    <Typography variant="body1">{formatDateTime(singleTaskResult.deadline)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Hoàn thành lúc</Typography>
                    <Typography variant="body1">{formatDateTime(singleTaskResult.finish_time)}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Chip
                      label={singleTaskResult.completed_before_deadline ? '✅ Đúng hạn' : '⚠️ Trễ hạn'}
                      color={singleTaskResult.completed_before_deadline ? 'success' : 'warning'}
                      sx={{ mt: 1 }}
                    />
                  </Grid>
                  {singleTaskResult.payment_result?.success && (
                    <>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                      </Grid>
                      <Grid item xs={12}>
                        <Alert severity="success">
                          <Typography variant="body2">
                            <strong>Thanh toán thành công!</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Transaction Hash: {singleTaskResult.payment_result.transactionHash}
                          </Typography>
                          <IconButton
                            size="small"
                            href={`https://sepolia.etherscan.io/tx/${singleTaskResult.payment_result.transactionHash}`}
                            target="_blank"
                            sx={{ mt: 1 }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Alert>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>
            ) : (
              <Alert severity="error">{singleTaskResult.message || singleTaskResult.error}</Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSingleTaskResult(null)}>Đóng</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Task Detail Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => {
          setDialogOpen(false);
          // Remove focus from any button to prevent aria-hidden warning
          setTimeout(() => {
            if (document.activeElement && document.activeElement.blur) {
              document.activeElement.blur();
            }
          }, 0);
        }} 
        maxWidth="md" 
        fullWidth
        disableEnforceFocus={false}
        disableRestoreFocus={false}
      >
        <DialogTitle>Chi tiết Task</DialogTitle>
        <DialogContent>
          {dialogTask && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6">{dialogTask.ten_cong_viec}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Task ID</Typography>
                <Typography variant="body1">{dialogTask.task_id}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Nhân viên</Typography>
                <Typography variant="body1">{dialogTask.employee_name}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Số ngày</Typography>
                <Typography variant="body1">{dialogTask.days_duration} ngày</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Trạng thái</Typography>
                <Chip
                  label={dialogTask.trang_thai}
                  size="small"
                  color={getStatusColor(dialogTask.trang_thai)}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Ngày bắt đầu</Typography>
                <Typography variant="body1">{formatDateTime(dialogTask.ngay_bat_dau)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Ngày kết thúc dự kiến</Typography>
                <Typography variant="body1">{formatDateTime(dialogTask.ngay_ket_thuc_du_kien)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Deadline (20:00 ngày kết thúc dự kiến)</Typography>
                <Typography variant="body1" fontWeight="bold">{formatDateTime(dialogTask.deadline)}</Typography>
              </Grid>
              {dialogTask.ngay_hoan_thanh_thuc_te && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Ngày hoàn thành thực tế</Typography>
                  <Typography variant="body1">{formatDateTime(dialogTask.ngay_hoan_thanh_thuc_te)}</Typography>
                  {dialogTask.is_completed_before_deadline !== null && (
                    <Chip
                      label={dialogTask.is_completed_before_deadline ? '✅ Đúng hạn' : '⚠️ Trễ hạn'}
                      size="small"
                      color={dialogTask.is_completed_before_deadline ? 'success' : 'warning'}
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Tiến độ</Typography>
                <Typography variant="body1" fontWeight="bold">{dialogTask.tien_do || 0}%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Giờ thực tế</Typography>
                <Typography variant="body1">{dialogTask.gio_thuc_te || 0}h</Typography>
              </Grid>
              {dialogTask.mo_ta && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Mô tả</Typography>
                  <Typography variant="body1">{dialogTask.mo_ta}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {dialogTask?.trang_thai === 'Hoàn thành' && (
            <Button
              variant="contained"
              startIcon={<CalculateIcon />}
              onClick={() => {
                handleCalculateSingle(dialogTask.task_id, true);
                setDialogOpen(false);
              }}
            >
              Tính KPI
            </Button>
          )}
          <Button onClick={() => setDialogOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MultiDayTaskCalculation;

