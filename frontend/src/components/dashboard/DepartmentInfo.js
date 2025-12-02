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
  Tooltip
} from '@mui/material';
import {
  Business,
  Person,
  Group,
  SupervisorAccount,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import authService from '../../services/authService';

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
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState('');

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (!user?.employee_did) return;

    if (!employeeData?.phong_ban_id) {
      setDepartment(null);
      setEmployees([]);
      setNoDepartment(true);
      setError(null);
      setLoading(false);
      return;
    }

    setNoDepartment(false);
    fetchDepartmentInfo();
  }, [user?.employee_did, employeeData?.phong_ban_id]);

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

  const getPositionColor = (position) => {
    if (position.toLowerCase().includes('manager') || position.toLowerCase().includes('lead')) {
      return 'primary';
    }
    if (position.toLowerCase().includes('senior')) {
      return 'secondary';
    }
    return 'default';
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
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (noDepartment) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Hiện tại nhân viên chưa thuộc phòng ban nào. Bạn có thể gửi yêu cầu cho Admin để được xếp vào phòng ban phù hợp.
        </Alert>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setContactError('');
            setContactSuccess('');
            setContactDialogOpen(true);
          }}
        >
          Liên hệ Admin để xếp phòng ban
        </Button>

        <Dialog
          open={contactDialogOpen}
          onClose={() => {
            if (!sendingContact) {
              setContactDialogOpen(false);
            }
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Gửi yêu cầu xếp phòng ban</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tin nhắn này sẽ được gửi tới Admin để họ biết bạn chưa thuộc phòng ban nào và hỗ trợ xếp phòng ban cho bạn.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder="Ví dụ: Em hiện chưa có phòng ban. Nhờ Admin xếp em vào phòng ban Kinh Doanh."
            />
            {contactError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {contactError}
              </Alert>
            )}
            {contactSuccess && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {contactSuccess}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                if (!sendingContact) {
                  setContactDialogOpen(false);
                }
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={async () => {
                if (!currentUser?.employee_did) {
                  setContactError('Không tìm thấy thông tin nhân viên. Vui lòng đăng nhập lại.');
                  return;
                }
                if (!contactMessage.trim()) {
                  setContactError('Vui lòng nhập nội dung tin nhắn.');
                  return;
                }
                try {
                  setSendingContact(true);
                  setContactError('');
                  await apiService.sendSupportMessage(currentUser.employee_did, contactMessage.trim(), 'employee');
                  setContactSuccess('Đã gửi yêu cầu đến Admin. Vui lòng chờ được xếp phòng ban.');
                  setContactMessage('');
                  if (onDataUpdate) onDataUpdate();
                } catch (err) {
                  console.error('Error sending support message:', err);
                  setContactError('Không thể gửi yêu cầu. Vui lòng thử lại sau.');
                } finally {
                  setSendingContact(false);
                }
              }}
              variant="contained"
              disabled={sendingContact}
            >
              {sendingContact ? 'Đang gửi...' : 'Gửi yêu cầu'}
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Thông Tin Phòng Ban
      </Typography>

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
                {employees.map((employee) => (
                  <ListItem key={employee.employee_did} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <Person />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
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
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          DID: {employee.employee_did}
                        </Typography>
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
                ))}
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
    </Box>
  );
};

export default DepartmentInfo;
