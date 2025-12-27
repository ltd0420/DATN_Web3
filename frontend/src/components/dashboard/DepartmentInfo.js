import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import {
  Business,
  Person,
  Group,
  SupervisorAccount,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Quiz as QuizIcon,
  OpenInNew as OpenInNewIcon,
  Verified as VerifiedIcon,
  Link as LinkIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import authService from '../../services/authService';
import DepartmentTest from './DepartmentTest';

const DepartmentInfo = ({ user, employeeData, onDataUpdate }) => {
  const [department, setDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addEmployeeDialog, setAddEmployeeDialog] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [noDepartment, setNoDepartment] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [web3Department, setWeb3Department] = useState(null);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [testDialog, setTestDialog] = useState({ open: false, departmentId: null, departmentName: '' });
  const [testResult, setTestResult] = useState(null);
  const [employeeBlockchainData, setEmployeeBlockchainData] = useState({}); // Store blockchain data for each employee

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    console.log('[DepartmentInfo] useEffect triggered:', {
      hasUser: !!user,
      employee_did: user?.employee_did,
      hasEmployeeData: !!employeeData,
      phong_ban_id: employeeData?.phong_ban_id,
      employeeDataKeys: employeeData ? Object.keys(employeeData) : []
    });

    if (!user?.employee_did) {
      console.log('[DepartmentInfo] No user employee_did, returning');
      return;
    }

    if (!employeeData?.phong_ban_id) {
      console.log('[DepartmentInfo] No phong_ban_id, setting noDepartment');
      setDepartment(null);
      setEmployees([]);
      setNoDepartment(true);
      setError(null);
      setLoading(false);
      setWeb3Department(null);
      setSelectedTab(0);
      return;
    }

    console.log('[DepartmentInfo] Has phong_ban_id, fetching department info');
    setNoDepartment(false);
    fetchDepartmentInfo();
    fetchWeb3Department();
  }, [user?.employee_did, employeeData?.phong_ban_id]);

  // Reset tab if web3Department changes and test tab is no longer available
  useEffect(() => {
    if (selectedTab === 1 && (!web3Department || !web3Department.require_test)) {
      setSelectedTab(0);
    }
  }, [web3Department, selectedTab]);

  // Load available departments with tests when no department
  useEffect(() => {
    if (noDepartment && user?.employee_did) {
      loadAvailableDepartments();
    }
  }, [noDepartment, user?.employee_did]);

  // Fetch blockchain data for all employees in the department
  const fetchEmployeesBlockchainData = async (employeesList, departmentId) => {
    if (!employeesList || employeesList.length === 0 || !departmentId || !employeeData?.phong_ban_id) {
      console.log('[DepartmentInfo] fetchEmployeesBlockchainData skipped:', {
        hasEmployees: !!employeesList && employeesList.length > 0,
        departmentId,
        phong_ban_id: employeeData?.phong_ban_id
      });
      return;
    }
    
    console.log('[DepartmentInfo] Fetching blockchain data for', employeesList.length, 'employees');
    const blockchainDataMap = {};
    
    for (const employee of employeesList) {
      try {
        // Get Web3 department member info
        let memberInfo = null;
        let departmentInfo = null;
        try {
          const web3DeptResponse = await apiService.get(`/web3/departments/${employeeData.phong_ban_id}?employeeDid=${employee.employee_did}`);
          memberInfo = web3DeptResponse?.data?.member;
          departmentInfo = web3DeptResponse?.data;
          console.log(`[DepartmentInfo] Web3 dept data for ${employee.employee_did}:`, {
            hasMember: !!memberInfo,
            memberTxHash: memberInfo?.blockchain_tx_hash,
            deptTxHash: departmentInfo?.blockchain_tx_hash
          });
        } catch (web3Error) {
          console.log(`[DepartmentInfo] No Web3 dept data for ${employee.employee_did}:`, web3Error.message);
        }
        
        // Get test result - try to get directly from test result endpoint
        // Use getOptional() to suppress 404 console logs (test result is optional)
        let testResultData = null;
        try {
          const testResultResponse = await apiService.getOptional(`/web3/test/${departmentId}/${employee.employee_did}`);
          // getOptional() returns { status, data, ... } format
          if (testResultResponse?.status === 200 && testResultResponse?.data) {
            const testResult = testResultResponse.data;
            console.log(`[DepartmentInfo] Test result response for ${employee.employee_did}:`, {
              hasData: !!testResult,
              fullResponse: testResult,
              txHash: testResult?.transaction_hash || testResult?.blockchain?.transaction_hash,
              blockNumber: testResult?.block_number || testResult?.blockchain?.block_number
            });
            if (testResult?.transaction_hash || testResult?.blockchain?.transaction_hash) {
              testResultData = testResult;
              console.log(`[DepartmentInfo] ✅ Test result data saved for ${employee.employee_did}:`, {
                transaction_hash: testResultData.transaction_hash || testResultData.blockchain?.transaction_hash,
                block_number: testResultData.block_number || testResultData.blockchain?.block_number
              });
            } else {
              console.log(`[DepartmentInfo] ⚠️ Test result found but no transaction hash for ${employee.employee_did}`);
            }
          }
        } catch (testError) {
          // Test result not found (404) - that's okay, employee may not have taken the test yet
          // getOptional() handles 404 gracefully, but network errors might still throw
          if (testError.response?.status !== 404 && testError.status !== 404) {
            console.log(`[DepartmentInfo] ❌ Error fetching test result for employee ${employee.employee_did}:`, testError.message);
          }
        }
        
        // Always add to map (even if no transaction hash yet) to allow UI to show state
        const testTxHash = testResultData?.transaction_hash || testResultData?.blockchain?.transaction_hash;
        const memberTxHash = memberInfo?.blockchain_tx_hash;
        const deptTxHash = departmentInfo?.blockchain_tx_hash;
        
        blockchainDataMap[employee.employee_did] = {
          member: memberInfo,
          testResult: testResultData,
          department: departmentInfo
        };
        
        const hasAnyTx = memberTxHash || testTxHash || deptTxHash;
        
        if (hasAnyTx) {
          console.log(`[DepartmentInfo] ✅ Blockchain data for ${employee.employee_did} (${employee.ho_ten || 'Unknown'}):`, {
            memberTx: memberTxHash,
            testTx: testTxHash,
            deptTx: deptTxHash,
            fullData: blockchainDataMap[employee.employee_did]
          });
        } else {
          console.log(`[DepartmentInfo] ⚠️ No blockchain transactions found for ${employee.employee_did} (${employee.ho_ten || 'Unknown'})`);
        }
      } catch (error) {
        console.log(`[DepartmentInfo] Error fetching blockchain data for ${employee.employee_did}:`, error.message);
      }
    }
    
    console.log('[DepartmentInfo] Setting employeeBlockchainData state with:', {
      totalEmployees: Object.keys(blockchainDataMap).length,
      blockchainDataMap: blockchainDataMap
    });
    
    setEmployeeBlockchainData(blockchainDataMap);
    
    const employeesWithTx = Object.keys(blockchainDataMap).filter(empId => {
      const data = blockchainDataMap[empId];
      const hasTx = data?.member?.blockchain_tx_hash || 
                    data?.testResult?.transaction_hash || 
                    data?.testResult?.blockchain?.transaction_hash || 
                    data?.department?.blockchain_tx_hash;
      return hasTx;
    });
    
    console.log('[DepartmentInfo] ✅ Employee blockchain data loaded:', {
      totalEmployees: Object.keys(blockchainDataMap).length,
      employeesWithTransactions: employeesWithTx.length,
      employeesWithTx: employeesWithTx,
      sampleData: blockchainDataMap[employeesWithTx[0]] || null
    });
  };

  // Fetch blockchain data when employees and web3Department are available
  useEffect(() => {
    console.log('[DepartmentInfo] useEffect for blockchain data - Current state:', {
      employeesCount: employees.length,
      hasWeb3Dept: !!web3Department?.department_id,
      web3DeptId: web3Department?.department_id,
      hasPhongBanId: !!employeeData?.phong_ban_id,
      phongBanId: employeeData?.phong_ban_id,
      employeeBlockchainDataKeys: Object.keys(employeeBlockchainData).length
    });
    
    if (employees.length > 0 && web3Department?.department_id && employeeData?.phong_ban_id) {
      console.log('[DepartmentInfo] ✅ useEffect triggered to fetch blockchain data');
      fetchEmployeesBlockchainData(employees, web3Department.department_id);
    } else {
      console.log('[DepartmentInfo] ⚠️ useEffect skipped - conditions not met');
    }
  }, [employees, web3Department?.department_id, employeeData?.phong_ban_id]);

  const loadAvailableDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const response = await apiService.get('/web3/departments');
      // Filter departments that require test and are active
      const departmentsWithTests = (response.data || []).filter(
        dept => dept.is_active && dept.require_test
      );
      setAvailableDepartments(departmentsWithTests);
    } catch (error) {
      console.error('Error loading available departments:', error);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchWeb3Department = async () => {
    if (!employeeData?.phong_ban_id) return;
    try {
      // Include employeeDid to get member info with blockchain transaction hash
      const employeeDid = user?.employee_did || employeeData?.employee_did;
      const url = employeeDid 
        ? `/web3/departments/${employeeData.phong_ban_id}?employeeDid=${employeeDid}`
        : `/web3/departments/${employeeData.phong_ban_id}`;
      const response = await apiService.get(url);
      console.log('[DepartmentInfo] Web3 Department data:', response.data);
      console.log('[DepartmentInfo] Full response:', JSON.stringify(response.data, null, 2));
      console.log('[DepartmentInfo] Blockchain TX Hash (department):', response.data?.blockchain_tx_hash);
      console.log('[DepartmentInfo] Blockchain TX Hash (member):', response.data?.member?.blockchain_tx_hash);
      console.log('[DepartmentInfo] Member info:', response.data?.member);
      setWeb3Department(response.data);
      
      // Also fetch test result to get test score transaction hash
      // Use getOptional() to suppress 404 console logs (test result is optional)
      if (employeeDid && response.data?.department_id) {
        try {
          // Route: /api/web3/test/:departmentId/:employeeDid
          const testResultResponse = await apiService.getOptional(`/web3/test/${response.data.department_id}/${employeeDid}`);
          // getOptional() returns { status, data, ... } format
          if (testResultResponse?.status === 200 && testResultResponse?.data) {
            const testResult = testResultResponse.data;
            console.log('[DepartmentInfo] Test result response:', testResult);
            if (testResult?.transaction_hash || testResult?.blockchain?.transaction_hash) {
              setTestResult(testResult);
              console.log('[DepartmentInfo] Test result with blockchain hash:', {
                transaction_hash: testResult.transaction_hash || testResult.blockchain?.transaction_hash,
                block_number: testResult.block_number || testResult.blockchain?.block_number
              });
            }
          }
        } catch (testError) {
          // Test result not found (404) or no blockchain hash - that's okay
          // getOptional() handles 404 gracefully, but network errors might still throw
          if (testError.response?.status !== 404 && testError.status !== 404) {
            console.log('[DepartmentInfo] No test result with blockchain hash found:', testError.message);
          }
        }
      }
    } catch (error) {
      // Phòng ban chưa có Web3, không có lỗi
      console.log('[DepartmentInfo] No Web3 department found or error:', error.message);
      setWeb3Department(null);
    }
  };

  useEffect(() => {
    if (addEmployeeDialog) {
      fetchAvailableEmployees();
    }
  }, [addEmployeeDialog, employees]);

  const fetchDepartmentInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      setNoDepartment(false);

      if (!user || !employeeData?.phong_ban_id) {
        setError('Không tìm thấy thông tin nhân viên');
        setLoading(false);
        return;
      }

      const departmentId = employeeData.phong_ban_id;

      // Get department details from the list to avoid 404s when the department has been removed
      const allDepartments = await apiService.getDepartments();
      const departmentDetails = allDepartments.find(
        (dept) => dept.phong_ban_id === departmentId
      );

      if (!departmentDetails) {
        setDepartment(null);
        setEmployees([]);
        setNoDepartment(true);
        return;
      }

      const employeesResponse = await apiService.getEmployeesByDepartment(departmentId);

      setDepartment(departmentDetails);
      setEmployees(employeesResponse);
    } catch (err) {
      console.error('Error fetching department info:', err);
      setError('Không thể tải thông tin phòng ban');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Đang làm việc':
        return 'success';
      case 'Nghỉ phép':
        return 'warning';
      case 'Tạm nghỉ':
        return 'info';
      case 'Đã nghỉ việc':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get on-chain status for employee
  const getOnChainStatus = (employee) => {
    const empBlockchainData = employeeBlockchainData[employee.employee_did];
    
    // Debug logging
    console.log(`[getOnChainStatus] Checking ${employee.employee_did}:`, {
      hasBlockchainData: !!empBlockchainData,
      memberTx: empBlockchainData?.member?.blockchain_tx_hash,
      testTx: empBlockchainData?.testResult?.transaction_hash,
      testTxBlockchain: empBlockchainData?.testResult?.blockchain?.transaction_hash,
      deptTx: empBlockchainData?.department?.blockchain_tx_hash,
      fullTestResult: empBlockchainData?.testResult
    });
    
    // Check for transaction hashes - handle null and undefined
    const memberTx = empBlockchainData?.member?.blockchain_tx_hash;
    const testTx = empBlockchainData?.testResult?.transaction_hash || empBlockchainData?.testResult?.blockchain?.transaction_hash;
    const deptTx = empBlockchainData?.department?.blockchain_tx_hash;
    
    // Filter out null, undefined, and empty strings
    const validMemberTx = memberTx && memberTx !== 'null' && memberTx !== 'undefined' ? memberTx : null;
    const validTestTx = testTx && testTx !== 'null' && testTx !== 'undefined' ? testTx : null;
    const validDeptTx = deptTx && deptTx !== 'null' && deptTx !== 'undefined' ? deptTx : null;
    
    const hasTx = validMemberTx || validTestTx || validDeptTx;
    
    console.log(`[getOnChainStatus] Result for ${employee.employee_did}:`, {
      hasTx: !!hasTx,
      memberTx: validMemberTx || 'none',
      testTx: validTestTx || 'none',
      deptTx: validDeptTx || 'none'
    });
    
    if (hasTx) {
      const txHash = validMemberTx || validTestTx || validDeptTx;
      return {
        label: 'On-chain',
        color: 'success',
        icon: <VerifiedIcon fontSize="small" />,
        txHash: txHash
      };
    } else {
      return {
        label: 'Off-chain',
        color: 'warning',
        icon: <WarningIcon fontSize="small" />
      };
    }
  };

  const getPositionColor = (position) => {
    if (position.toLowerCase().includes('manager') || position.toLowerCase().includes('lead')) {
      return 'primary';
    }
    if (position.toLowerCase().includes('senior')) {
      return 'secondary';
    }
    return 'default';
  };

  const fetchAvailableEmployees = async () => {
    try {
      const response = await apiService.getAllEmployees();
      // Filter out employees already in this department
      const available = response.filter(emp => !employees.some(deptEmp => deptEmp.employee_did === emp.employee_did));
      setAvailableEmployees(available);
    } catch (error) {
      console.error('Error fetching available employees:', error);
    }
  };

  // Debug logging - MUST be before any early returns to avoid "Rendered more hooks" error
  useEffect(() => {
    console.log('[DepartmentInfo] Component state:', {
      hasUser: !!user,
      hasEmployeeData: !!employeeData,
      phong_ban_id: employeeData?.phong_ban_id,
      noDepartment,
      loading,
      error,
      department: !!department,
      testDialogOpen: testDialog.open,
      testDialogDepartmentId: testDialog.departmentId
    });
  }, [user, employeeData, noDepartment, loading, error, department, testDialog]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (noDepartment) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
          Thông Tin Phòng Ban
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Hiện tại nhân viên chưa thuộc phòng ban nào. Bạn có thể làm bài test để tham gia phòng ban.
        </Alert>

        {/* Available Departments with Tests */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
            Phòng Ban Có Sẵn Bài Test
          </Typography>
          
          {loadingDepartments ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : availableDepartments.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Hiện chưa có phòng ban nào có sẵn bài test. Vui lòng liên hệ Admin.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {availableDepartments.map((dept) => (
                <Grid item xs={12} md={6} lg={4} key={dept.department_id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Business sx={{ mr: 1, color: 'primary.main', fontSize: 32 }} />
                        <Typography variant="h6" fontWeight="bold">
                          {dept.department_name}
                        </Typography>
                      </Box>
                      
                      <Box mb={2}>
                        <Chip 
                          icon={<QuizIcon />}
                          label={`Điểm tối thiểu: ${dept.min_test_score}%`}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                      
        <Button
                        fullWidth
          variant="contained"
                        startIcon={<QuizIcon />}
          onClick={() => {
                          console.log('[DepartmentInfo] Clicked "Làm Bài Test" for department:', dept.department_id, dept.department_name);
                          setTestDialog({
                            open: true,
                            departmentId: dept.department_id,
                            departmentName: dept.department_name
                          });
                          console.log('[DepartmentInfo] Test dialog state set:', {
                            open: true,
                            departmentId: dept.department_id,
                            departmentName: dept.department_name
                          });
                        }}
                        sx={{ mt: 'auto' }}
                      >
                        Làm Bài Test
        </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* Test Dialog for Available Departments */}
        <Dialog
          open={testDialog.open}
          onClose={() => {
            console.log('[DepartmentInfo] Closing test dialog');
            setTestDialog({ open: false, departmentId: null, departmentName: '' });
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <QuizIcon color="primary" />
              <Typography variant="h6">
                Làm Bài Test - {testDialog.departmentName || 'Phòng Ban'}
            </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {(() => {
              console.log('[DepartmentInfo] Rendering DialogContent, testDialog:', {
                open: testDialog.open,
                departmentId: testDialog.departmentId,
                departmentName: testDialog.departmentName
              });
              return testDialog.departmentId ? (
                <Box sx={{ mt: 2 }}>
                  {console.log('[DepartmentInfo] Rendering DepartmentTest with:', {
                    departmentId: testDialog.departmentId,
                    departmentName: testDialog.departmentName,
                    hasUser: !!user
                  })}
                  <DepartmentTest
                    key={testDialog.departmentId} // Force re-render when departmentId changes
                    departmentId={testDialog.departmentId}
                    departmentName={testDialog.departmentName}
                    user={user}
                    skipCheckResult={true} // Skip check result vì employee không phải là member (noDepartment = true)
                    onTestComplete={async (result) => {
                      try {
                        console.log('[DepartmentInfo] Test completed:', result);
                        
                        // Close dialog first
                        setTestDialog({ open: false, departmentId: null, departmentName: '' });
                        
                        // Wait a bit for backend to process assignment
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Reload employee data to get updated phong_ban_id
                        try {
                          const profileResponse = await apiService.getEmployeeProfile(user?.employee_did);
                          if (profileResponse?.data?.phong_ban_id || profileResponse?.phong_ban_id) {
                            // Employee was assigned to department, refresh data
                            if (onDataUpdate) {
                              onDataUpdate();
                            }
                            // Use setTimeout to delay reload and avoid React state update errors
                            setTimeout(() => {
                              window.location.reload();
                            }, 100);
                          } else {
                            // Still refresh data even if phong_ban_id not set yet
                            if (onDataUpdate) {
                              onDataUpdate();
                            }
                          }
                        } catch (profileError) {
                          console.error('[DepartmentInfo] Error refreshing employee data:', profileError);
                          // Still try to refresh data
                          if (onDataUpdate) {
                            onDataUpdate();
                          }
                        }
                      } catch (error) {
                        console.error('[DepartmentInfo] Error in onTestComplete:', error);
                        // Ensure dialog is closed even on error
                        setTestDialog({ open: false, departmentId: null, departmentName: '' });
                      }
                    }}
                  />
                </Box>
              ) : (
                <Alert severity="warning">
                  Không tìm thấy thông tin phòng ban. Vui lòng thử lại.
              </Alert>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              console.log('[DepartmentInfo] Closing test dialog from button');
              setTestDialog({ open: false, departmentId: null, departmentName: '' });
            }}>
              Đóng
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  if (!department) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Không tìm thấy thông tin phòng ban
      </Alert>
    );
  }

  const manager = employees.find(emp => emp.employee_did === department.truong_phong_did);

  const handleAddEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      await apiService.assignEmployeeToDepartment(selectedEmployee, department.phong_ban_id);
      setAddEmployeeDialog(false);
      setSelectedEmployee('');
      fetchDepartmentInfo();
      if (onDataUpdate) onDataUpdate();
    } catch (error) {
      console.error('Error adding employee to department:', error);
      setError('Không thể thêm nhân viên vào phòng ban');
    }
  };

  const handleRemoveEmployee = async (employeeDid) => {
    try {
      await apiService.removeEmployeeFromDepartment(employeeDid);
      fetchDepartmentInfo();
      if (onDataUpdate) onDataUpdate();
    } catch (error) {
      console.error('Error removing employee from department:', error);
      setError('Không thể xóa nhân viên khỏi phòng ban');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Thông Tin Phòng Ban
      </Typography>

      {loading && <CircularProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}


      {department && (
        <Card sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Thông Tin Phòng Ban" />
          {/* Chỉ hiển thị tab "Làm Bài Test" nếu nhân viên chưa thuộc phòng ban (noDepartment = true) */}
          {/* Nếu đã thuộc phòng ban rồi thì không cần làm test nữa */}
        </Tabs>

        {selectedTab === 0 && (
          <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Department Information Card */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Business sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  {department.ten_phong_ban}
                </Typography>
              </Box>

              {department.mo_ta && (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {department.mo_ta}
                </Typography>
              )}

              <Box display="flex" alignItems="center" mb={1}>
                <SupervisorAccount sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="body2">
                  <strong>Trưởng phòng:</strong> {manager ? `${manager.employee_did} - ${manager.ho_ten}` : 'Chưa có'}
                </Typography>
              </Box>

              <Box display="flex" alignItems="center">
                <Group sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2">
                  <strong>Tổng số nhân viên:</strong> {employees.length}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Manager Information Card */}
        {manager && (
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  Trưởng Phòng
                </Typography>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    <Person />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {manager.employee_did} - {manager.ho_ten}
                    </Typography>
                    <Chip
                      label={manager.trang_thai}
                      color={getStatusColor(manager.trang_thai)}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  DID: {manager.employee_did}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}


        {/* Department Members */}
        <Grid item xs={12}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Thành Viên Phòng Ban ({employees.length})
                </Typography>
                {currentUser?.role_id === '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b' && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddEmployeeDialog(true)}
                    size="small"
                  >
                    Thêm Nhân Viên
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {employees.map((employee) => {
                  // Debug logging for each employee
                  const empBlockchainData = employeeBlockchainData[employee.employee_did];
                  const hasTestTx = !!(empBlockchainData?.testResult?.transaction_hash || empBlockchainData?.testResult?.blockchain?.transaction_hash);
                  const hasMemberTx = !!empBlockchainData?.member?.blockchain_tx_hash;
                  const hasDeptTx = !!empBlockchainData?.department?.blockchain_tx_hash;
                  
                  // Log for debugging - log all employees, not just those with transactions
                  console.log(`[DepartmentInfo] 🔍 Rendering employee ${employee.employee_did} (${employee.ho_ten || 'Unknown'}):`, {
                    hasBlockchainData: !!empBlockchainData,
                    hasTestTx,
                    hasMemberTx,
                    hasDeptTx,
                    testTx: empBlockchainData?.testResult?.transaction_hash || empBlockchainData?.testResult?.blockchain?.transaction_hash || 'none',
                    memberTx: empBlockchainData?.member?.blockchain_tx_hash || 'none',
                    deptTx: empBlockchainData?.department?.blockchain_tx_hash || 'none',
                    willShowLinks: hasTestTx || hasMemberTx || hasDeptTx,
                    fullBlockchainData: empBlockchainData
                  });
                  
                  const onChainStatus = getOnChainStatus(employee);
                  
                  console.log(`[DepartmentInfo] ✅ On-chain status for ${employee.employee_did}:`, {
                    label: onChainStatus.label,
                    hasTxHash: !!onChainStatus.txHash,
                    txHash: onChainStatus.txHash || 'none'
                  });
                  
                  return (
                  <ListItem key={employee.employee_did} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <Person />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="subtitle1" fontWeight="bold">
                            {employee.ho_ten}
                          </Typography>
                          <Chip
                            label={employee.trang_thai}
                            color={getStatusColor(employee.trang_thai)}
                            size="small"
                          />
                          {employee.employee_did === department.truong_phong_did && (
                            <Chip
                              label="Trưởng phòng"
                              color="primary"
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {/* On-chain Status Chip - Only show if has transaction */}
                          {onChainStatus.txHash && (
                            <>
                              <Chip
                                label={onChainStatus.label}
                                color={onChainStatus.color}
                                size="small"
                                icon={onChainStatus.icon}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`https://sepolia.etherscan.io/tx/${onChainStatus.txHash}`, '_blank', 'noopener,noreferrer');
                                }}
                                sx={{
                                  cursor: 'pointer',
                                  '&:hover': {
                                    backgroundColor: onChainStatus.color === 'success' ? 'success.dark' : 'warning.dark'
                                  }
                                }}
                              />
                              {/* Blockchain Link Button */}
                              <Tooltip title="Xem trên blockchain">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://sepolia.etherscan.io/tx/${onChainStatus.txHash}`, '_blank', 'noopener,noreferrer');
                                  }}
                                  sx={{ 
                                    color: '#667eea',
                                    '&:hover': { 
                                      backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                      color: '#764ba2'
                                    }
                                  }}
                                >
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                            DID: {employee.employee_did}
                          </Typography>
                          {(hasTestTx || hasMemberTx || hasDeptTx) && (
                            <Box component="span" sx={{ display: 'block', mt: 1 }}>
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                                🔗 Blockchain Transactions:
                              </Typography>
                              <Box component="span" display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                {hasMemberTx && empBlockchainData?.member?.blockchain_tx_hash && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    startIcon={<OpenInNewIcon />}
                                    onClick={() => {
                                      const txHash = empBlockchainData.member.blockchain_tx_hash;
                                      console.log('[DepartmentInfo] Opening Join Department TX:', txHash);
                                      window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank', 'noopener,noreferrer');
                                    }}
                                    sx={{ 
                                      fontSize: '0.75rem', 
                                      textTransform: 'none',
                                      minWidth: 'auto',
                                      px: 1.5,
                                      py: 0.5
                                    }}
                                  >
                                    Join Department
                                  </Button>
                                )}
                                {hasTestTx && (empBlockchainData?.testResult?.transaction_hash || empBlockchainData?.testResult?.blockchain?.transaction_hash) && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<OpenInNewIcon />}
                                    onClick={() => {
                                      const txHash = empBlockchainData?.testResult?.transaction_hash ||
                                                     empBlockchainData?.testResult?.blockchain?.transaction_hash;
                                      console.log('[DepartmentInfo] Opening Test Score TX:', txHash);
                                      if (txHash) {
                                        window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank', 'noopener,noreferrer');
                                      }
                                    }}
                                    sx={{ 
                                      fontSize: '0.75rem', 
                                      textTransform: 'none',
                                      minWidth: 'auto',
                                      px: 1.5,
                                      py: 0.5
                                    }}
                                  >
                                    Test Score
                                  </Button>
                                )}
                                {hasDeptTx && empBlockchainData?.department?.blockchain_tx_hash && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    startIcon={<OpenInNewIcon />}
                                    onClick={() => {
                                      const txHash = empBlockchainData.department.blockchain_tx_hash;
                                      console.log('[DepartmentInfo] Opening Create Department TX:', txHash);
                                      window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank', 'noopener,noreferrer');
                                    }}
                                    sx={{ 
                                      fontSize: '0.75rem', 
                                      textTransform: 'none',
                                      minWidth: 'auto',
                                      px: 1.5,
                                      py: 0.5
                                    }}
                                  >
                                    Create Department
                                  </Button>
                                )}
                              </Box>
                            </Box>
                          )}
                        </>
                      }
                    />
                    {currentUser?.role_id === '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b' && (
                      <Box>
                        <Tooltip title="Xóa khỏi phòng ban">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveEmployee(employee.employee_did)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </ListItem>
                  );
                })}
              </List>

              {employees.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  Chưa có nhân viên nào trong phòng ban này
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
          </Box>
        )}

      {/* Add Employee Dialog */}
      <Dialog
        open={addEmployeeDialog}
        onClose={() => setAddEmployeeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Thêm Nhân Viên Vào Phòng Ban</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Chọn Nhân Viên</InputLabel>
            <Select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              label="Chọn Nhân Viên"
            >
              {availableEmployees.map((employee) => (
                <MenuItem key={employee.employee_did} value={employee.employee_did}>
                  {employee.ho_ten} - {employee.employee_did} ({employee.chuc_vu})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEmployeeDialog(false)}>Hủy</Button>
          <Button
            onClick={handleAddEmployee}
            variant="contained"
            disabled={!selectedEmployee}
          >
            Thêm
          </Button>
        </DialogActions>
      </Dialog>
      </Card>
      )}
    </Box>
  );
};

export default DepartmentInfo;
