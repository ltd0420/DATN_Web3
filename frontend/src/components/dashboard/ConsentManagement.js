import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Chip, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Alert, CircularProgress, Card, CardContent, Divider, Switch, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';

const ConsentManagement = ({ user, employeeData }) => {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog states
  const [giveConsentDialog, setGiveConsentDialog] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState(null);

  // Form states
  const [consentForm, setConsentForm] = useState({
    consentType: '',
    purpose: '',
    duration: 0, // 0 for permanent
    ipfsHash: ''
  });

  useEffect(() => {
    if (user?.employee_did) {
      loadConsents();
    }
  }, [user]);

  const loadConsents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getEmployeeConsents(user.employee_did);
      setConsents(response.consents || []);
    } catch (err) {
      console.error('Load consents error:', err);
      setError('Không thể tải danh sách đồng ý');
    } finally {
      setLoading(false);
    }
  };

  const handleGiveConsent = async () => {
    try {
      setError('');
      setSuccess('');

      const consentData = {
        employeeDid: user.employee_did,
        ...consentForm
      };

      const response = await apiService.giveConsent(consentData);
      setSuccess('Đã cấp đồng ý thành công');

      // Reset form and close dialog
      setConsentForm({
        consentType: '',
        purpose: '',
        duration: 0,
        ipfsHash: ''
      });
      setGiveConsentDialog(false);

      // Reload consents
      loadConsents();
    } catch (err) {
      console.error('Give consent error:', err);
      setError('Không thể cấp đồng ý');
    }
  };

  const handleRevokeConsent = async () => {
    try {
      setError('');
      setSuccess('');

      await apiService.revokeConsent(selectedConsent.consentId);
      setSuccess('Đã thu hồi đồng ý thành công');

      setRevokeDialog(false);
      setSelectedConsent(null);

      // Reload consents
      loadConsents();
    } catch (err) {
      console.error('Revoke consent error:', err);
      setError('Không thể thu hồi đồng ý');
    }
  };

  const getConsentTypeLabel = (type) => {
    const types = {
      'data_processing': 'Xử lý dữ liệu',
      'data_sharing': 'Chia sẻ dữ liệu',
      'data_storage': 'Lưu trữ dữ liệu',
      'data_analysis': 'Phân tích dữ liệu',
      'marketing': 'Marketing',
      'research': 'Nghiên cứu'
    };
    return types[type] || type;
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'success' : 'error';
  };

  const getStatusLabel = (isActive) => {
    return isActive ? 'Hoạt động' : 'Không hoạt động';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Quản lý Đồng ý
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setGiveConsentDialog(true)}
        >
          Cấp Đồng ý
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Consent Statistics */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Thống kê Đồng ý
              </Typography>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Tổng số:</Typography>
                <Typography variant="body2" fontWeight="bold">{consents.length}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Hoạt động:</Typography>
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  {consents.filter(c => c.isActive).length}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Không hoạt động:</Typography>
                <Typography variant="body2" fontWeight="bold" color="error.main">
                  {consents.filter(c => !c.isActive).length}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Consent List */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Danh sách Đồng ý
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {consents.length === 0 ? (
              <Box textAlign="center" py={4}>
                <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Chưa có đồng ý nào
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nhấn "Cấp Đồng ý" để tạo đồng ý đầu tiên
                </Typography>
              </Box>
            ) : (
              <List>
                {consents.map((consent) => (
                  <ListItem key={consent.consentId} divider>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1">
                            {getConsentTypeLabel(consent.consentType)}
                          </Typography>
                          <Chip
                            label={getStatusLabel(consent.isActive)}
                            color={getStatusColor(consent.isActive)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Mục đích: {consent.purpose}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Cấp ngày: {new Date(consent.issuedAt).toLocaleDateString('vi-VN')}
                            {consent.expiresAt && ` - Hết hạn: ${new Date(consent.expiresAt).toLocaleDateString('vi-VN')}`}
                          </Typography>
                          {consent.ipfsHash && (
                            <Typography variant="body2" color="text.secondary">
                              IPFS: {consent.ipfsHash}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {consent.isActive && (
                        <IconButton
                          edge="end"
                          onClick={() => {
                            setSelectedConsent(consent);
                            setRevokeDialog(true);
                          }}
                          color="error"
                        >
                          <CancelIcon />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Give Consent Dialog */}
      <Dialog open={giveConsentDialog} onClose={() => setGiveConsentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cấp Đồng ý Mới</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Loại Đồng ý</InputLabel>
              <Select
                value={consentForm.consentType}
                onChange={(e) => setConsentForm({ ...consentForm, consentType: e.target.value })}
                label="Loại Đồng ý"
              >
                <MenuItem value="data_processing">Xử lý dữ liệu</MenuItem>
                <MenuItem value="data_sharing">Chia sẻ dữ liệu</MenuItem>
                <MenuItem value="data_storage">Lưu trữ dữ liệu</MenuItem>
                <MenuItem value="data_analysis">Phân tích dữ liệu</MenuItem>
                <MenuItem value="marketing">Marketing</MenuItem>
                <MenuItem value="research">Nghiên cứu</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Mục đích"
              multiline
              rows={3}
              value={consentForm.purpose}
              onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value })}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Thời hạn (ngày, 0 = vĩnh viễn)"
              type="number"
              value={consentForm.duration}
              onChange={(e) => setConsentForm({ ...consentForm, duration: parseInt(e.target.value) || 0 })}
              margin="normal"
              inputProps={{ min: 0 }}
            />

            <TextField
              fullWidth
              label="IPFS Hash (tùy chọn)"
              value={consentForm.ipfsHash}
              onChange={(e) => setConsentForm({ ...consentForm, ipfsHash: e.target.value })}
              margin="normal"
              placeholder="Qm..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGiveConsentDialog(false)}>Hủy</Button>
          <Button
            onClick={handleGiveConsent}
            variant="contained"
            disabled={!consentForm.consentType || !consentForm.purpose}
          >
            Cấp Đồng ý
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Consent Dialog */}
      <Dialog open={revokeDialog} onClose={() => setRevokeDialog(false)}>
        <DialogTitle>Xác nhận Thu hồi Đồng ý</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc chắn muốn thu hồi đồng ý này không?
          </Typography>
          {selectedConsent && (
            <Box mt={2}>
              <Typography variant="body2">
                <strong>Loại:</strong> {getConsentTypeLabel(selectedConsent.consentType)}
              </Typography>
              <Typography variant="body2">
                <strong>Mục đích:</strong> {selectedConsent.purpose}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialog(false)}>Hủy</Button>
          <Button onClick={handleRevokeConsent} variant="contained" color="error">
            Thu hồi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConsentManagement;
