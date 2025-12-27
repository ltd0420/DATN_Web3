import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Alert, Snackbar,
  TextField, Chip, LinearProgress, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, Tabs, Tab, IconButton
} from '@mui/material';
import {
  Business as BusinessIcon,
  Quiz as QuizIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import authService from '../../services/authService';
import DepartmentTest from './DepartmentTest';

const DepartmentWeb3Join = ({ user, employeeData }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [testDialog, setTestDialog] = useState({ open: false, departmentId: null, departmentName: '' });
  const [testScore, setTestScore] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState(null);

  // Get employee_did from user or employeeData
  const employeeDid = user?.employee_did || employeeData?.employee_did;
  const walletAddress = user?.walletAddress || employeeData?.walletAddress;

  useEffect(() => {
    console.log('[DepartmentWeb3Join] Component mounted', { user, employeeData, employeeDid });
    if (employeeDid) {
      loadDepartments();
    } else {
      console.warn('[DepartmentWeb3Join] Employee DID not found', { user, employeeData });
      setError('Employee DID not found. Please check your profile.');
    }
  }, [employeeDid]);

  const loadDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[DepartmentWeb3Join] Loading departments...');
      const response = await apiService.get('/web3/departments');
      console.log('[DepartmentWeb3Join] Departments response:', response.data);
      const activeDepartments = response.data?.filter(d => d.is_active) || [];
      setDepartments(activeDepartments);
      console.log('[DepartmentWeb3Join] Active departments:', activeDepartments);
      if (activeDepartments.length === 0) {
        setError('Chưa có phòng ban Web3 nào đang hoạt động.');
      }
    } catch (error) {
      console.error('[DepartmentWeb3Join] Failed to load departments:', error);
      setError('Không thể tải danh sách phòng ban. Vui lòng thử lại sau.');
      showSnackbar('Không thể tải danh sách phòng ban', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const checkQualification = async (departmentId) => {
    if (!employeeDid) {
      return { qualified: false, reason: 'Không tìm thấy DID nhân viên' };
    }
    try {
      const response = await apiService.get(
        `/web3/departments/${departmentId}/qualification/${employeeDid}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to check qualification:', error);
      return { qualified: false, reason: 'Không thể kiểm tra điều kiện' };
    }
  };

  const handleJoinDepartment = async (department) => {
    try {
      const qualification = await checkQualification(department.department_id);
      
      if (!qualification.qualified) {
        showSnackbar(
          qualification.reason || 'Bạn chưa đáp ứng đủ điều kiện tham gia',
          'warning'
        );
        return;
      }

      if (!employeeDid) {
        showSnackbar('Không tìm thấy DID nhân viên. Vui lòng kiểm tra hồ sơ của bạn.', 'error');
        return;
      }

      const response = await apiService.post('/web3/departments/join', {
        departmentId: department.department_id,
        employeeDid: employeeDid,
        walletAddress: walletAddress
      });

      if (response.data.success) {
        showSnackbar(
          `Tham gia ${department.department_name} thành công!`,
          'success'
        );
        loadDepartments();
      }
    } catch (error) {
      showSnackbar(
        error.response?.data?.message || 'Không thể tham gia phòng ban',
        'error'
      );
    }
  };

  const handleRecordTestScore = async () => {
    try {
      if (!employeeDid) {
        showSnackbar('Không tìm thấy DID nhân viên. Vui lòng kiểm tra hồ sơ của bạn.', 'error');
        return;
      }

      await apiService.post('/web3/test/record', {
        departmentId: testDialog.departmentId,
        employeeDid: employeeDid,
        score: parseInt(testScore)
      });
      showSnackbar('Ghi điểm test thành công!');
      setTestDialog({ open: false, departmentId: null });
      setTestScore('');
      loadDepartments();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Không thể ghi điểm test', 'error');
    }
  };

  if (!employeeDid) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Không tìm thấy thông tin nhân viên. Vui lòng kiểm tra hồ sơ của bạn hoặc liên hệ quản trị viên.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        Tham Gia Phòng Ban Web3
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Tham gia các phòng ban Web3 bằng cách làm bài test đạt điểm yêu cầu
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {departments.length === 0 && !loading && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chưa có phòng ban Web3 nào đang hoạt động. Vui lòng quay lại sau.
        </Alert>
      )}

      <Grid container spacing={3}>
        {departments.map((dept) => (
          <Grid item xs={12} md={6} key={dept.department_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">{dept.department_name}</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Điều kiện tham gia:
                  </Typography>
                  {dept.require_test && (
                    <Chip
                      icon={<QuizIcon />}
                      label={`Test: ≥${dept.min_test_score} điểm`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  )}
                  {!dept.require_test && (
                    <Chip
                      label="Không yêu cầu điều kiện"
                      size="small"
                      color="success"
                      sx={{ mb: 1 }}
                    />
                  )}
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    ID: {dept.department_id}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  {dept.require_test && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<QuizIcon />}
                      onClick={() => setTestDialog({ 
                        open: true, 
                        departmentId: dept.department_id,
                        departmentName: dept.department_name
                      })}
                    >
                      Làm Bài Test
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    onClick={() => handleJoinDepartment(dept)}
                    sx={{ flex: 1 }}
                    startIcon={<CheckCircleIcon />}
                  >
                    Tham Gia Phòng Ban
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Test Dialog */}
      <Dialog 
        open={testDialog.open} 
        onClose={() => setTestDialog({ open: false, departmentId: null, departmentName: '' })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{testDialog.departmentName} - Bài Test</Typography>
            <IconButton onClick={() => setTestDialog({ open: false, departmentId: null, departmentName: '' })}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {testDialog.departmentId && employeeDid && (
            <DepartmentTest
              departmentId={testDialog.departmentId}
              departmentName={testDialog.departmentName}
              user={{ ...user, employee_did: employeeDid }}
              onTestComplete={(result) => {
                showSnackbar(`Hoàn thành bài test! Điểm: ${result.percentage_score}%`, 'success');
                setTestDialog({ open: false, departmentId: null, departmentName: '' });
                loadDepartments();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default DepartmentWeb3Join;

