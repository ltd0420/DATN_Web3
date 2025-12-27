import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Alert, Snackbar,
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
  LinearProgress, Stepper, Step, StepLabel, Paper, Chip
} from '@mui/material';
import {
  Quiz as QuizIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';
import authService from '../../services/authService';

const DepartmentTest = ({ departmentId, departmentName, user, onTestComplete, skipCheckResult = false }) => {
  console.log('[DepartmentTest] Component rendered with props:', {
    departmentId,
    departmentName,
    hasUser: !!user,
    employee_did: user?.employee_did,
    skipCheckResult
  });

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    console.log('[DepartmentTest] useEffect triggered, departmentId:', departmentId);
    // Reset test result và answers khi departmentId thay đổi
    setTestResult(null);
    setAnswers({});
    setCurrentStep(0);
    if (departmentId) {
      loadQuestions();
      // Chỉ check existing result nếu không skip (ví dụ: employee không phải là member)
      if (!skipCheckResult) {
        // Delay một chút để đảm bảo backend đã xóa test data cũ
        setTimeout(() => {
          checkExistingResult();
        }, 100);
      } else {
        console.log('[DepartmentTest] Skipping check existing result (employee not a member)');
        setTestResult(null);
      }
    } else {
      console.warn('[DepartmentTest] No departmentId provided, skipping load');
    }
  }, [departmentId]);

  const loadQuestions = async () => {
    if (!departmentId) {
      console.error('[DepartmentTest] No departmentId provided');
      return;
    }
    setLoading(true);
    try {
      console.log('[DepartmentTest] Loading questions for department:', departmentId);
      const response = await apiService.get(`/web3/test/questions/${departmentId}`);
      console.log('[DepartmentTest] Questions loaded:', response.data?.length || 0);
      setQuestions(response.data || []);
    } catch (error) {
      console.error('[DepartmentTest] Error loading questions:', error);
      showSnackbar(error.response?.data?.message || 'Không thể tải câu hỏi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingResult = async () => {
    if (!user?.employee_did) {
      console.log('[DepartmentTest] No user employee_did, skipping checkExistingResult');
      setTestResult(null);
      return;
    }
    try {
      console.log('[DepartmentTest] Checking existing result for:', { departmentId, employeeDid: user.employee_did });
      // Sử dụng getOptional (fetch API) để giảm thiểu console logs
      // Lưu ý: Browser DevTools vẫn có thể log 404 vào Network tab và Console
      // Đây là expected behavior và không phải là lỗi thực sự
      const response = await apiService.getOptional(`/web3/test/${departmentId}/${user.employee_did}`);
      
      // Nếu response status là 404, không có test result (expected behavior)
      // 404 có nghĩa là employee không còn là member hoặc chưa làm test
      if (response.status === 404) {
        console.log('[DepartmentTest] No existing test result (employee not a member or test not taken)');
        setTestResult(null);
        return;
      }
      
      // Chỉ set test result nếu có dữ liệu hợp lệ
      if (response.data && response.data._id) {
        console.log('[DepartmentTest] Found existing test result:', response.data._id);
        setTestResult(response.data);
      } else {
        console.log('[DepartmentTest] No valid test result data');
        setTestResult(null);
      }
    } catch (error) {
      // Chỉ log error cho các lỗi thực sự (500+, network errors, etc.)
      console.warn('[DepartmentTest] Error checking existing result:', error.response?.status, error.message);
      setTestResult(null);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleAnswerChange = (questionId, answerIndex) => {
    setAnswers({
      ...answers,
      [questionId]: answerIndex
    });
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate all questions answered
    const unansweredQuestions = questions.filter(q => answers[q.question_id] === undefined);
    if (unansweredQuestions.length > 0) {
      showSnackbar(`Vui lòng trả lời tất cả câu hỏi. Còn ${unansweredQuestions.length} câu hỏi chưa trả lời.`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const answersArray = questions.map(q => ({
        question_id: q.question_id,
        selected_answer_index: answers[q.question_id]
      }));

      const response = await apiService.post('/web3/test/submit', {
        departmentId: departmentId,
        employeeDid: user.employee_did,
        answers: answersArray
      });

      if (response.data.success) {
        // Merge submission data with answerDetails to get full answer information
        const submission = response.data.submission || {};
        const answerDetails = response.data.answerDetails || [];
        
        // Create test result with full answer details
        const testResultData = {
          ...submission,
          answers: answerDetails.length > 0 ? answerDetails : (submission.answers || []),
          percentage_score: submission.percentage_score || 
            (submission.max_score > 0 ? Math.round((submission.score / submission.max_score) * 100) : 0)
        };
        
        setTestResult(testResultData);
        showSnackbar(response.data.message, 'success');
        // Call onTestComplete in a safe way to avoid React errors
        if (onTestComplete) {
          try {
            // Use setTimeout to ensure state updates are complete before calling callback
            setTimeout(() => {
              if (onTestComplete) {
                onTestComplete(testResultData);
              }
            }, 100);
          } catch (callbackError) {
            console.error('[DepartmentTest] Error in onTestComplete callback:', callbackError);
          }
        }
      }
    } catch (error) {
      console.error('[DepartmentTest] Submit error:', error);
      console.error('[DepartmentTest] Error response:', error.response?.data);
      showSnackbar(error.response?.data?.message || error.message || 'Không thể nộp bài test', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (testResult) {
    // Show test result
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Hoàn Thành Bài Test!
            </Typography>
            <Chip
              label={`Điểm: ${testResult.percentage_score}%`}
              color={testResult.percentage_score >= 70 ? 'success' : 'error'}
              sx={{ fontSize: '1.2rem', p: 2 }}
            />
            <Typography variant="body1" sx={{ mt: 2 }}>
              {testResult.score} / {testResult.max_score} điểm
            </Typography>
            
            {/* Blockchain Transaction Link */}
            {(testResult.transaction_hash || testResult.blockchain?.transaction_hash) && (
              <Box 
                sx={{ 
                  mt: 3, 
                  pt: 2, 
                  borderTop: 2, 
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  bgcolor: 'primary.light',
                  p: 2
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'primary.contrastText' }}>
                  🔗 Thông Tin Blockchain
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'primary.contrastText', opacity: 0.9 }}>
                  Kết quả test của bạn đã được ghi lên blockchain Sepolia.
                </Typography>
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<OpenInNewIcon />}
                  href={`https://sepolia.etherscan.io/tx/${testResult.transaction_hash || testResult.blockchain?.transaction_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ 
                    mb: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    }
                  }}
                >
                  Xem Transaction Test trên Etherscan
                </Button>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'primary.contrastText', opacity: 0.8 }}>
                  Block: {testResult.block_number || testResult.blockchain?.block_number || 'N/A'}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Xem Lại Đáp Án</Typography>
            {testResult.answers && Array.isArray(testResult.answers) && testResult.answers.length > 0 ? (
              testResult.answers.map((answer, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ flex: 1 }}>
                    Câu Hỏi {index + 1}
                  </Typography>
                  {answer.is_correct ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <CancelIcon color="error" />
                  )}
                    <Chip
                      label={`${answer.points} điểm`}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {answer.question_text || 'N/A'}
                </Typography>
                <Box sx={{ ml: 2 }}>
                  {answer.options && Array.isArray(answer.options) ? (
                    answer.options.map((option, optIndex) => (
                      <Box key={optIndex} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Radio
                          checked={answer.selected_answer_index === optIndex}
                          disabled
                          size="small"
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            color: optIndex === answer.correct_answer_index ? 'success.main' :
                                   optIndex === answer.selected_answer_index && !answer.is_correct ? 'error.main' :
                                   'text.secondary'
                          }}
                        >
                          {option}
                          {optIndex === answer.correct_answer_index && ' ✓'}
                          {optIndex === answer.selected_answer_index && !answer.is_correct && ' ✗'}
                        </Typography>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Không có thông tin đáp án
                    </Typography>
                  )}
                </Box>
              </Paper>
            ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Không có câu trả lời nào
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <LinearProgress />;
  }

  if (questions.length === 0) {
    return (
      <Alert severity="info">
        Chưa có câu hỏi test cho phòng ban này.
      </Alert>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            {departmentName} - Bài Test
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Câu {currentStep + 1} / {questions.length}
          </Typography>
        </Box>

        <Stepper activeStep={currentStep} sx={{ mb: 3 }}>
          {questions.map((q, index) => (
            <Step key={q.question_id}>
              <StepLabel>
                {answers[q.question_id] !== undefined ? '✓' : index + 1}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {currentQuestion.question_text}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Điểm: {currentQuestion.points}
          </Typography>

          <FormControl component="fieldset">
            <RadioGroup
              value={answers[currentQuestion.question_id]?.toString() || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.question_id, parseInt(e.target.value))}
            >
              {currentQuestion.options.map((option, index) => (
                <FormControlLabel
                  key={index}
                  value={index.toString()}
                  control={<Radio />}
                  label={option}
                  sx={{ mb: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            Trước
          </Button>
          
          {currentStep === questions.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Đang nộp...' : 'Nộp Bài'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
            >
              Tiếp
            </Button>
          )}
        </Box>
      </CardContent>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Card>
  );
};

export default DepartmentTest;

