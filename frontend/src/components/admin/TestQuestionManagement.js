import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip, Alert,
  Snackbar, LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';

const TestQuestionManagement = ({ departmentId, departmentName }) => {
  const [questions, setQuestions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    question_id: '',
    question_text: '',
    options: ['', ''],
    correct_answer_index: 0,
    points: 10,
    order: 0
  });

  useEffect(() => {
    if (departmentId) {
      loadQuestions();
    }
  }, [departmentId]);

  const loadQuestions = async () => {
    try {
      // Use admin endpoint to get questions with correct_answer_index
      const response = await apiService.get(`/web3/test/questions-admin/${departmentId}`);
      setQuestions(response.data);
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
  };

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, '']
    });
  };

  const handleRemoveOption = (index) => {
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      options: newOptions,
      correct_answer_index: formData.correct_answer_index >= newOptions.length 
        ? newOptions.length - 1 
        : formData.correct_answer_index
    });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = async () => {
    try {
      await apiService.post('/web3/test/question', {
        departmentId: departmentId,
        ...formData
      });
      setOpenDialog(false);
      resetForm();
      loadQuestions();
      showSnackbar('Thêm câu hỏi thành công', 'success');
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Không thể thêm câu hỏi', 'error');
    }
  };

  const handleDelete = async (questionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
      return;
    }
    try {
      await apiService.delete(`/web3/test/question/${departmentId}/${questionId}`);
      loadQuestions();
      showSnackbar('Xóa câu hỏi thành công', 'success');
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Không thể xóa câu hỏi', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input để có thể chọn lại file cùng tên
    event.target.value = '';
  };

  const handleFileUpload = async (file) => {
    if (!file) {
      showSnackbar('Vui lòng chọn file', 'warning');
      return;
    }

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      showSnackbar('Vui lòng chọn file JSON', 'error');
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      formDataToSend.append('departmentId', departmentId);

      // apiService already handles FormData correctly
      const response = await apiService.post('/web3/test/import-json', formDataToSend);

      if (response.data.success) {
        setImportResult(response.data.results);
        showSnackbar(
          `Import thành công ${response.data.results.success} câu hỏi! ${response.data.results.failed > 0 ? `${response.data.results.failed} câu thất bại.` : ''}`,
          response.data.results.failed > 0 ? 'warning' : 'success'
        );
        loadQuestions();
      }
    } catch (error) {
      console.error('Upload error:', error);
      showSnackbar(
        error.response?.data?.message || 'Không thể import câu hỏi',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      question_id: '',
      question_text: '',
      options: ['', ''],
      correct_answer_index: 0,
      points: 10,
      order: questions.length
    });
  };

  if (!departmentId) {
    return (
      <Alert severity="info">
        Vui lòng chọn phòng ban để quản lý câu hỏi test
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6">
          Câu Hỏi Test - {departmentName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !departmentId}
          >
            Import JSON
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}
            disabled={!departmentId}
          >
            Thêm Câu Hỏi
          </Button>
        </Box>
      </Box>

      {uploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Đang import câu hỏi...
          </Typography>
        </Box>
      )}

      {importResult && (
        <Alert 
          severity={importResult.failed > 0 ? 'warning' : 'success'} 
          sx={{ mb: 2 }}
          onClose={() => setImportResult(null)}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Kết quả import: {importResult.success}/{importResult.total} thành công
          </Typography>
          {importResult.failed > 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Có {importResult.failed} câu hỏi thất bại:
              </Typography>
              {importResult.errors.slice(0, 5).map((error, idx) => (
                <Typography key={idx} variant="caption" display="block" sx={{ ml: 2 }}>
                  • Câu {error.index + 1} (ID: {error.question_id}): {error.error}
                </Typography>
              ))}
              {importResult.errors.length > 5 && (
                <Typography variant="caption" sx={{ ml: 2 }}>
                  ... và {importResult.errors.length - 5} lỗi khác
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Thứ Tự</TableCell>
              <TableCell>Câu Hỏi</TableCell>
              <TableCell>Các Lựa Chọn</TableCell>
              <TableCell>Đáp Án Đúng</TableCell>
              <TableCell>Điểm</TableCell>
              <TableCell>Thao Tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {questions.map((q) => (
              <TableRow key={q.question_id}>
                <TableCell>{q.order}</TableCell>
                <TableCell>{q.question_text}</TableCell>
                <TableCell>
                  {q.options.map((opt, idx) => (
                    <Chip key={idx} label={`${idx + 1}. ${opt}`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={
                      (q.correct_answer_index !== undefined && q.correct_answer_index !== null && 
                       q.options && q.options[q.correct_answer_index])
                        ? `${q.correct_answer_index + 1}. ${q.options[q.correct_answer_index]}`
                        : (q.correct_answer_index !== undefined && q.correct_answer_index !== null)
                          ? `Option ${q.correct_answer_index + 1}`
                          : 'Chưa có'
                    }
                    color="success"
                    size="small"
                  />
                </TableCell>
                <TableCell>{q.points}</TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => handleDelete(q.question_id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Question Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Thêm Câu Hỏi</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Mã Câu Hỏi"
              value={formData.question_id}
              onChange={(e) => setFormData({ ...formData, question_id: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Nội Dung Câu Hỏi"
              value={formData.question_text}
              onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
              margin="normal"
              multiline
              rows={2}
              required
            />
            
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Các Lựa Chọn:</Typography>
            {formData.options.map((option, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  label={`Lựa Chọn ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  size="small"
                />
                {formData.options.length > 2 && (
                  <IconButton onClick={() => handleRemoveOption(index)}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            <Button onClick={handleAddOption} size="small" sx={{ mb: 2 }}>
              Thêm Lựa Chọn
            </Button>

            <TextField
              fullWidth
              type="number"
              label="Chỉ Số Đáp Án Đúng (bắt đầu từ 0)"
              value={formData.correct_answer_index}
              onChange={(e) => setFormData({ ...formData, correct_answer_index: parseInt(e.target.value) })}
              margin="normal"
              inputProps={{ min: 0, max: formData.options.length - 1 }}
              helperText={`Chọn chỉ số của đáp án đúng (0 đến ${formData.options.length - 1})`}
            />
            <TextField
              fullWidth
              type="number"
              label="Điểm"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
              margin="normal"
              inputProps={{ min: 1 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Thứ Tự"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button onClick={handleSubmit} variant="contained">Thêm</Button>
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

export default TestQuestionManagement;
