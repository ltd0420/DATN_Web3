import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Avatar, Chip, Divider,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, CircularProgress, useTheme, useMediaQuery
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Wallet as WalletIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  VerifiedUser as VerifiedIcon,
  Schedule as ScheduleIcon,
  AccountBalance as AccountIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';

function PersonalProfile({ user, employeeData, onDataUpdate }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    chuc_vu: '',
    ngay_vao_lam: '',
    ai_profile_summary: ''
  });

  useEffect(() => {
    if (employeeData) {
      setFormData({
        chuc_vu: employeeData.chuc_vu || '',
        ngay_vao_lam: employeeData.ngay_vao_lam || '',
        ai_profile_summary: employeeData.ai_profile_summary || ''
      });
    }
  }, [employeeData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const { employee_did } = user;
      await apiService.updateEmployeeProfile(employee_did, formData);

      setSuccess('Cập nhật hồ sơ thành công!');
      setEditDialogOpen(false);
      onDataUpdate(); // Refresh data

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Update profile error:', err);
      setError('Không thể cập nhật hồ sơ. Vui lòng thử lại.');
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

  return (
    <Box>
      {/* Header with Gradient - Compact */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          borderRadius: 2,
          p: 2,
          mb: 2,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" position="relative" zIndex={1}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
        Hồ sơ cá nhân
      </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Quản lý thông tin cá nhân và cài đặt tài khoản
            </Typography>
          </Box>
          <Avatar
            sx={{
              width: 60,
              height: 60,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <PersonIcon sx={{ fontSize: 30, color: 'white' }} />
          </Avatar>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Main Profile Card */}
        <Grid item xs={12} lg={8}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.light}15 0%, ${theme.palette.secondary.light}15 100%)`,
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
                <Box display="flex" alignItems="center" gap={2}>
                <Avatar
                  sx={{
                      width: 70,
                      height: 70,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
                  }}
                >
                    <PersonIcon sx={{ fontSize: 35 }} />
                </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {employeeData?.employee_did || 'Chưa cập nhật'}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    {employeeData?.chuc_vu || 'Nhân viên'}
                  </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap" mt={0.5}>
                    <Chip
                      label={employeeData?.trang_thai || 'Đang làm việc'}
                      color={getStatusColor(employeeData?.trang_thai)}
                      size="small"
                        sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24 }}
                    />
                    <Chip
                        icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
                      label="Đã xác thực ví"
                      color="success"
                      size="small"
                      variant="outlined"
                        sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24 }}
                    />
                    </Box>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => setEditDialogOpen(true)}
                  size="small"
                  sx={{
                    borderRadius: 1.5,
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: `0 2px 8px ${theme.palette.primary.main}40`,
                  }}
                >
                  Chỉnh sửa
                </Button>
              </Box>
              </Box>

            <CardContent sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 12px ${theme.palette.primary.main}20`,
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          background: `${theme.palette.primary.main}15`,
                          color: theme.palette.primary.main,
                        }}
                      >
                        <WalletIcon fontSize="small" />
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                        Địa chỉ ví
                      </Typography>
                        <Typography 
                          variant="body2" 
                          fontFamily="monospace" 
                          fontWeight={600}
                          sx={{ wordBreak: 'break-all', fontSize: '0.8rem' }}
                        >
                          {user?.walletAddress || 'Chưa kết nối'}
                      </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: theme.palette.secondary.main,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 12px ${theme.palette.secondary.main}20`,
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          background: `${theme.palette.secondary.main}15`,
                          color: theme.palette.secondary.main,
                        }}
                      >
                        <BusinessIcon fontSize="small" />
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                        Phòng ban
                      </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                        {employeeData?.phong_ban_id?.ten_phong_ban || employeeData?.phong_ban_id || 'Chưa cập nhật'}
                      </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: theme.palette.success.main,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 12px ${theme.palette.success.main}20`,
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          background: `${theme.palette.success.main}15`,
                          color: theme.palette.success.main,
                        }}
                      >
                        <WorkIcon fontSize="small" />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                        Chức vụ
                      </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                        {employeeData?.chuc_vu || 'Nhân viên'}
                      </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: theme.palette.info.main,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 12px ${theme.palette.info.main}20`,
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          background: `${theme.palette.info.main}15`,
                          color: theme.palette.info.main,
                        }}
                      >
                        <ScheduleIcon fontSize="small" />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                        Ngày vào làm
                      </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                          {employeeData?.ngay_vao_lam ? new Date(employeeData.ngay_vao_lam).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Chưa cập nhật'}
                      </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                {employeeData?.email && (
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1.5,
                            background: `${theme.palette.warning.main}15`,
                            color: theme.palette.warning.main,
                          }}
                        >
                          <AccountIcon fontSize="small" />
                        </Box>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                          Email
                        </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                          {employeeData.email}
                        </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                )}

                {employeeData?.so_dien_thoai && (
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1.5,
                            background: `${theme.palette.error.main}15`,
                            color: theme.palette.error.main,
                          }}
                        >
                          <AccountIcon fontSize="small" />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                          Số điện thoại
                        </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                          {employeeData.so_dien_thoai}
                        </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats Card - Compact */}
        <Grid item xs={12} lg={4}>
          <Card
            sx={{
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2 }}>
                Thống kê nhanh
              </Typography>
              <Box display="flex" flexDirection="column" gap={1.5}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    borderRadius: 1.5,
                    background: `linear-gradient(135deg, ${theme.palette.secondary.main}15, ${theme.palette.secondary.main}05)`,
                    border: `2px solid ${theme.palette.secondary.main}30`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${theme.palette.secondary.main}30`,
                    },
                  }}
                >
                  <Typography variant="h4" color="secondary" fontWeight="bold" gutterBottom>
                    {employeeData?.consent_pointer ? '1' : '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Consent đã ký
                  </Typography>
                </Box>

                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    borderRadius: 1.5,
                    background: `linear-gradient(135deg, ${theme.palette.success.main}15, ${theme.palette.success.main}05)`,
                    border: `2px solid ${theme.palette.success.main}30`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${theme.palette.success.main}30`,
                    },
                  }}
                >
                  <Typography variant="h4" color="success.main" fontWeight="bold" gutterBottom>
                    {employeeData?.wallet_verified ? '1' : '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Ví đã xác thực
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Profile Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Chỉnh sửa hồ sơ cá nhân
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Chức vụ"
                value={formData.chuc_vu}
                onChange={(e) => handleInputChange('chuc_vu', e.target.value)}
              >
                <MenuItem value="Intern">Intern</MenuItem>
                <MenuItem value="Junior Developer">Junior Developer</MenuItem>
                <MenuItem value="Senior Developer">Senior Developer</MenuItem>
                <MenuItem value="Tech Lead">Tech Lead</MenuItem>
                <MenuItem value="Designer">Designer</MenuItem>
                <MenuItem value="QA Engineer">QA Engineer</MenuItem>
                <MenuItem value="DevOps Engineer">DevOps Engineer</MenuItem>
                <MenuItem value="Data Engineer">Data Engineer</MenuItem>
                <MenuItem value="Data Scientist">Data Scientist</MenuItem>
                <MenuItem value="Product Manager">Product Manager</MenuItem>
                <MenuItem value="Project Manager">Project Manager</MenuItem>
                <MenuItem value="HR Specialist">HR Specialist</MenuItem>
                <MenuItem value="Finance Analyst">Finance Analyst</MenuItem>
                <MenuItem value="Sales Executive">Sales Executive</MenuItem>
                <MenuItem value="Customer Support">Customer Support</MenuItem>
                <MenuItem value="Marketing Specialist">Marketing Specialist</MenuItem>
                <MenuItem value="Team Lead">Team Lead</MenuItem>
                <MenuItem value="Manager">Manager</MenuItem>
                <MenuItem value="Director">Director</MenuItem>
                <MenuItem value="VP">VP</MenuItem>
                <MenuItem value="CTO">CTO</MenuItem>
                <MenuItem value="CFO">CFO</MenuItem>
                <MenuItem value="COO">COO</MenuItem>
                <MenuItem value="CEO">CEO</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Ngày vào làm"
                type="date"
                value={formData.ngay_vao_lam}
                onChange={(e) => handleInputChange('ngay_vao_lam', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tóm tắt hồ sơ AI"
                multiline
                rows={4}
                value={formData.ai_profile_summary}
                onChange={(e) => handleInputChange('ai_profile_summary', e.target.value)}
                placeholder="Nhập tóm tắt hồ sơ được tạo bởi AI..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSaveProfile}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonalProfile;
