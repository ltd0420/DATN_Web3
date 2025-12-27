import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Alert, Snackbar,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Tooltip, Switch, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Quiz as QuizIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import TestQuestionManagement from './TestQuestionManagement';

const DepartmentWeb3Management = ({ user }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedDepartmentMembers, setSelectedDepartmentMembers] = useState(null);
  const [membersDialog, setMembersDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    department_id: '',
    department_name: '',
    require_test: true, // Mặc định bật test
    min_test_score: 70
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/web3/departments');
      setDepartments(response.data);
    } catch (error) {
      showSnackbar('Không thể tải danh sách phòng ban', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateDepartment = async () => {
    try {
      const response = await apiService.post('/web3/departments', formData);
      const department = response.data;
      
      let message = 'Tạo phòng ban thành công!';
      if (department.blockchain_tx_hash) {
        message += ` Transaction: ${department.blockchain_tx_hash.slice(0, 10)}...`;
      }
      
      showSnackbar(message);
      setOpenDialog(false);
      resetForm();
      loadDepartments();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Không thể tạo phòng ban', 'error');
    }
  };

  const handleDeleteDepartment = async (departmentId, departmentName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng ban "${departmentName}"?\n\nCảnh báo: Tất cả dữ liệu liên quan (thành viên, câu hỏi test, kết quả bỏ phiếu) sẽ bị xóa vĩnh viễn!`)) {
      return;
    }

    try {
      await apiService.delete(`/web3/departments/${departmentId}`);
      showSnackbar('Xóa phòng ban thành công!', 'success');
      loadDepartments();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Không thể xóa phòng ban', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      department_id: '',
      department_name: '',
      require_test: true,
      min_test_score: 70
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Quản Lý Phòng Ban Web3
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Tạo Phòng Ban
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)}>
            <Tab label="Tất Cả Phòng Ban" />
            <Tab label="Câu Hỏi Test" />
            <Tab label="Quản Lý Bỏ Phiếu" />
          </Tabs>

          {selectedTab === 1 && (
            <Box sx={{ mt: 3 }}>
              {departments.length > 0 ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>Chọn Phòng Ban Để Quản Lý Câu Hỏi</Typography>
                  {departments.map((dept) => (
                    <Card key={dept.department_id} sx={{ mb: 2 }}>
                      <CardContent>
                        <TestQuestionManagement
                          departmentId={dept.department_id}
                          departmentName={dept.department_name}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Alert severity="info">Chưa có phòng ban nào. Vui lòng tạo phòng ban trước.</Alert>
              )}
            </Box>
          )}

          {selectedTab === 0 && (
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={2}>
                {departments.map((dept) => (
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
                              onClick={() => handleDeleteDepartment(dept.department_id, dept.department_name)}
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
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Create Department Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tạo Phòng Ban Web3</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Mã Phòng Ban"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Tên Phòng Ban"
              value={formData.department_name}
              onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
              margin="normal"
              required
            />

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.require_test}
                    onChange={(e) => setFormData({ ...formData, require_test: e.target.checked })}
                  />
                }
                label="Yêu Cầu Test"
              />
              {formData.require_test && (
                <TextField
                  fullWidth
                  type="number"
                  label="Điểm Tối Thiểu"
                  value={formData.min_test_score}
                  onChange={(e) => setFormData({ ...formData, min_test_score: parseInt(e.target.value) })}
                  margin="normal"
                  inputProps={{ min: 0, max: 100 }}
                  helperText="Điểm tối thiểu để được tham gia phòng ban (0-100)"
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button onClick={handleCreateDepartment} variant="contained">
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members Dialog */}
      <Dialog 
        open={membersDialog} 
        onClose={() => setMembersDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Thành Viên - {selectedDepartmentMembers?.department?.department_name}
        </DialogTitle>
        <DialogContent>
          {selectedDepartmentMembers?.members && selectedDepartmentMembers.members.length > 0 ? (
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
                  {selectedDepartmentMembers.members.map((member) => (
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
          <Button onClick={() => setMembersDialog(false)}>Đóng</Button>
        </DialogActions>
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

export default DepartmentWeb3Management;

