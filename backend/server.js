const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
connectDB();

// Khôi phục các timer auto-approve sau khi kết nối database
// Đợi 3 giây để đảm bảo database đã sẵn sàng
setTimeout(() => {
  const { restorePendingTimers } = require('./services/autoApproveMilestoneService');
  restorePendingTimers();
}, 3000);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user-specific room for notifications
  socket.on('join', (userDid) => {
    socket.join(userDid);
    console.log(`User ${userDid} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible in controllers
app.set('io', io);

// Routes
app.get('/', (req, res) => {
  res.send('Web3 HR Management API is running...');
});

// Import controllers
const authController = require('./controllers/authController');
const rolesController = require('./controllers/rolesController');
const danhMucPhongBanController = require('./controllers/danhMucPhongBanController');
const hoSoNhanVienController = require('./controllers/hoSoNhanVienController');
const chamCongController = require('./controllers/chamCongController');
const smartContractLogsController = require('./controllers/smartContractLogsController');
const qrAuthenticationController = require('./controllers/qrAuthenticationController');
const consentController = require('./controllers/consentController');
const eventLogsUserController = require('./controllers/eventLogsUserController');
const congViecGiaoController = require('./controllers/congViecGiaoController');
const kpiStatsController = require('./controllers/kpiStatsController');
const multiDayTaskController = require('./controllers/multiDayTaskController');
const employeeKpiRewardsController = require('./controllers/employeeKpiRewardsController');
const multer = require('multer');

// Verify multiDayTaskController is loaded
if (!multiDayTaskController || !multiDayTaskController.getMultiDayTasks) {
  console.error('[Server] ERROR: multiDayTaskController not loaded correctly!');
  console.error('[Server] Available methods:', Object.keys(multiDayTaskController || {}));
}

// Configure multer for file uploads - Support up to 1GB per file
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, 'uploads', 'tasks');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      // Preserve original filename but sanitize for filesystem
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const name = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
      // Use safe filename for storage, but keep original in database
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit per file
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true);
  }
});

// Auth routes
app.post('/api/auth/challenge', authController.generateChallenge);
app.post('/api/auth/verify', authController.verifySignature);
app.post('/api/auth/logout', authController.authenticateToken, authController.logout);
app.get('/api/auth/profile', authController.authenticateToken, authController.getProfile);

// Roles and Permissions routes (protected)
app.get('/api/roles', authController.authenticateToken, rolesController.getAllRoles);
app.get('/api/roles/:role_id', authController.authenticateToken, rolesController.getRoleById);
app.post('/api/roles', authController.authenticateToken, rolesController.createRole);
app.put('/api/roles/:role_id', authController.authenticateToken, rolesController.updateRole);
app.delete('/api/roles/:role_id', authController.authenticateToken, rolesController.deleteRole);
app.get('/api/roles/permissions/me', authController.authenticateToken, rolesController.getUserPermissions);

// Protected routes - require authentication
// BƯỚC 1: XÓA DÒNG BÊN DƯỚI
// app.use('/api/employees', authController.authenticateToken);
// app.use('/api/departments', authController.authenticateToken);
// app.use('/api/attendance', authController.authenticateToken); // Temporarily disabled for testing
// app.use('/api/attendance', authController.authenticateToken); // Disabled for testing Attendance History feature
app.use('/api/kpi', authController.authenticateToken);
app.use('/api/reviews', authController.authenticateToken);
app.use('/api/rankings', authController.authenticateToken);
app.use('/api/payroll', authController.authenticateToken);

// Temporarily disable auth for testing notifications
app.get('/api/logs/events/test/:userDid', async (req, res) => {
  try {
    const eventLogsUser = await require('./models/EventLogsUser').find({ user_did: req.params.userDid });
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Temporarily disable auth for logs
// app.use('/api/logs', authController.authenticateToken);

// Department routes (protected)
app.get('/api/departments', danhMucPhongBanController.getAll);
app.get('/api/departments/:id', danhMucPhongBanController.getById);
app.post('/api/departments', authController.authenticateToken, danhMucPhongBanController.create);
app.put('/api/departments/:id', authController.authenticateToken, danhMucPhongBanController.update);
app.post('/api/departments/:id/assign-employee', authController.authenticateToken, danhMucPhongBanController.assignEmployeeToDepartment);
app.delete('/api/departments/:id', authController.authenticateToken, danhMucPhongBanController.delete);
app.delete('/api/departments/remove-employee/:employeeDid', authController.authenticateToken, danhMucPhongBanController.removeEmployeeFromDepartment);

// Employee routes
// BƯỚC 2: THÊM `authController.authenticateToken` VÀO 5 DÒNG BÊN DƯỚI
app.get('/api/employees', authController.authenticateToken, hoSoNhanVienController.getAll);
app.get('/api/employees/department/:departmentId', authController.authenticateToken, hoSoNhanVienController.getEmployeesByDepartment);
app.get('/api/employees/wallet/:walletAddress', authController.authenticateToken, hoSoNhanVienController.getByWallet);
app.get('/api/employees/:id', authController.authenticateToken, hoSoNhanVienController.getById);
app.post('/api/employees', authController.authenticateToken, hoSoNhanVienController.create);
app.put('/api/employees/:id', authController.authenticateToken, hoSoNhanVienController.update);
app.delete('/api/employees/:id', authController.authenticateToken, hoSoNhanVienController.delete);

// Update user wallet address
app.put('/api/employees/:id/wallet', authController.authenticateToken, hoSoNhanVienController.updateWalletAddress);

// Attendance routes (protected)
app.get('/api/attendance', authController.authenticateToken, chamCongController.getAll);
app.get('/api/attendance/:id', authController.authenticateToken, chamCongController.getById);
app.post('/api/attendance', authController.authenticateToken, chamCongController.create);
app.put('/api/attendance/:id', authController.authenticateToken, chamCongController.update);
app.delete('/api/attendance/:id', authController.authenticateToken, chamCongController.delete);

// Additional attendance routes (protected)
app.get('/api/attendance/employee/:employeeDid', chamCongController.getByEmployee);
app.get('/api/attendance/date-range', authController.authenticateToken, chamCongController.getByDateRange);
app.get('/api/attendance/employee/:employeeDid/date/:date', authController.authenticateToken, chamCongController.getByEmployeeAndDate);
app.post('/api/attendance/checkin', authController.authenticateToken, chamCongController.checkIn);
app.post('/api/attendance/checkout', authController.authenticateToken, chamCongController.checkOut);
app.post('/api/attendance/:id/pay', authController.authenticateToken, chamCongController.payAttendanceRecord);
// Missed checkout handling
app.post('/api/attendance/report-missed-checkout', authController.authenticateToken, chamCongController.reportMissedCheckout);

// Admin attendance routes (protected with HR/Admin role)
app.post('/api/attendance/admin/manual', authController.authenticateToken, chamCongController.createManualAttendance);
app.put('/api/attendance/admin/:id', authController.authenticateToken, chamCongController.updateManualAttendance);
app.post('/api/attendance/admin/approve/:id', authController.authenticateToken, chamCongController.approveAttendance);
app.post('/api/attendance/admin/approve-overtime/:id', authController.authenticateToken, chamCongController.approveOvertime);
app.post('/api/attendance/admin/approve-leave/:id', authController.authenticateToken, chamCongController.approveLeave);
app.post('/api/attendance/admin/missed-checkout/:id', authController.authenticateToken, chamCongController.approveMissedCheckout);
app.post('/api/attendance/admin/bulk-update', authController.authenticateToken, chamCongController.bulkUpdateAttendance);
app.get('/api/attendance/admin/pending-approvals', authController.authenticateToken, chamCongController.getPendingApprovals);
app.get('/api/attendance/admin/report', authController.authenticateToken, chamCongController.getAttendanceReport);

// Get smart contract logs for attendance record
app.get('/api/logs/contracts/attendance/:recordId', async (req, res) => {
  try {
    const SmartContractLogs = require('./models/SmartContractLogs');
    const logs = await SmartContractLogs.find({
      'parameters.employeeDid': req.params.recordId
    }).sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// KPI routes


// KPI Stats routes
app.get('/api/kpi/stats', kpiStatsController.getKpiStats);
app.get('/api/kpi/stats/dashboard', kpiStatsController.getDashboardStats);

// Payroll contract management routes (must be before /api/payroll/:id)
const payrollContractService = require('./services/payrollContractService');
app.get('/api/payroll/contract-info', authController.authenticateToken, async (req, res) => {
  try {
    console.log('[GET /api/payroll/contract-info] Request received');
    console.log('[GET /api/payroll/contract-info] User:', req.user?.employee_did || req.user?.user_id);
    const info = await payrollContractService.getContractInfo();
    console.log('[GET /api/payroll/contract-info] Full info object:', JSON.stringify(info, null, 2));
    console.log('[GET /api/payroll/contract-info] Success:', {
      contractTokenBalance: info.contractTokenBalance,
      tokenSymbol: info.tokenSymbol,
      hasContractTokenBalance: !!info.contractTokenBalance,
      hasTokenSymbol: !!info.tokenSymbol
    });
    res.json(info);
  } catch (error) {
    console.error('[GET /api/payroll/contract-info] Error:', error.message);
    console.error('[GET /api/payroll/contract-info] Stack:', error.stack);
    res.status(500).json({ 
      message: error.message,
      error: error.toString()
    });
  }
});
app.post('/api/payroll/deposit', authController.authenticateToken, async (req, res) => {
  try {
    // Only Super Admin can deposit
    const userRole = await require('./models/RolesPermissions').findOne({ role_id: req.user.role_id });
    if (!userRole || userRole.ten_vai_tro !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }
    const { amount } = req.body; // amount in tokens (USDT)
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const result = await payrollContractService.transferTokensToContract(amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Smart contract logs routes
app.get('/api/logs/contracts', smartContractLogsController.getAllSmartContractLogs);
app.get('/api/logs/contracts/:id', smartContractLogsController.getSmartContractLogsByTxHash);
app.post('/api/logs/contracts', smartContractLogsController.createSmartContractLogs);


// QR Authentication routes (with blockchain support)
app.get('/api/qr', qrAuthenticationController.getAllQrAuthentication);
app.get('/api/qr/:id', qrAuthenticationController.getQrAuthenticationById);
app.get('/api/qr/employee/:employeeDid', qrAuthenticationController.getQrAuthenticationByEmployee);
app.post('/api/qr', qrAuthenticationController.createQrAuthentication);
app.put('/api/qr/:id', qrAuthenticationController.updateQrAuthentication);
app.delete('/api/qr/:id', qrAuthenticationController.deleteQrAuthentication);

// Generate new QR code for employee (with blockchain minting)
app.post('/api/qr/generate/:employeeDid', qrAuthenticationController.generateNewQrCode);

// Validate QR code for login (with blockchain verification)
app.post('/api/qr/validate-login', qrAuthenticationController.validateQrForLogin);

// Revoke QR authentication (with blockchain burn)
app.put('/api/qr/revoke/:id', qrAuthenticationController.revokeQrAuthentication);

// Welcome endpoint for QR authentication with logging
app.get('/api/qr/welcome', qrAuthenticationController.welcomeQr);

// Consent Management routes (protected)
app.post('/api/consent', authController.authenticateToken, consentController.giveConsent);
app.put('/api/consent/:consentId/revoke', authController.authenticateToken, consentController.revokeConsent);
app.get('/api/consent/:consentId/valid', authController.authenticateToken, consentController.checkConsent);
app.get('/api/consent/employee/:employeeDid/type/:consentType/active', authController.authenticateToken, consentController.checkActiveConsent);
app.get('/api/consent/employee/:employeeDid', authController.authenticateToken, consentController.getEmployeeConsents);
app.get('/api/consent/:consentId', authController.authenticateToken, consentController.getConsentDetails);

// User Event Logs routes
// Note: Specific routes must come before parameterized routes
app.get('/api/logs/events', eventLogsUserController.getAllEventLogsUser);
app.post('/api/logs/events', eventLogsUserController.createEventLogsUser);
app.delete('/api/logs/events/read/:userDid', eventLogsUserController.deleteReadEventLogs);
app.delete('/api/logs/events/all/:userDid', eventLogsUserController.deleteAllEventLogs);
app.delete('/api/logs/events/delete/:id', eventLogsUserController.deleteEventLogsUser);
app.get('/api/logs/events/:userDid', eventLogsUserController.getEventLogsUserByUser);
app.put('/api/logs/events/:id', eventLogsUserController.markAsRead);

// Task Management routes (protected)
console.log('[Server] Registering task routes...');
app.get('/api/tasks', authController.authenticateToken, congViecGiaoController.getAll);
// Specific routes must come before parameterized routes to avoid route conflicts
app.get('/api/tasks/employee/:employeeDid', authController.authenticateToken, congViecGiaoController.getByEmployee);
app.get('/api/tasks/employee/:employeeDid/pending', authController.authenticateToken, congViecGiaoController.getPendingTasksByEmployee);

// Employee KPI Rewards routes
app.get('/api/employee/kpi-rewards/:employeeDid', authController.authenticateToken, employeeKpiRewardsController.getEmployeeKpiRewards);
app.get('/api/tasks/assigner/:assignerDid', authController.authenticateToken, congViecGiaoController.getByAssigner);
app.get('/api/tasks/status/:status', authController.authenticateToken, congViecGiaoController.getByStatus);
app.get('/api/tasks/priority/:priority', authController.authenticateToken, congViecGiaoController.getByPriority);
app.get('/api/tasks/department/:departmentId', authController.authenticateToken, congViecGiaoController.getByDepartment);
app.get('/api/tasks/overdue', authController.authenticateToken, congViecGiaoController.getOverdueTasks);
app.get('/api/tasks/stats', authController.authenticateToken, congViecGiaoController.getTaskStats);
app.get('/api/tasks/stats/detailed', authController.authenticateToken, congViecGiaoController.getDetailedTaskStats);

// Multi-day task routes (must be before all parameterized routes)
app.get('/api/tasks/multi-day', authController.authenticateToken, multiDayTaskController.getMultiDayTasks);
app.post('/api/tasks/multi-day/calculate-average', authController.authenticateToken, multiDayTaskController.calculateAverageCompletionRate);
app.post('/api/tasks/multi-day/:taskId/calculate', authController.authenticateToken, multiDayTaskController.calculateMultiDayTaskKpi);
app.post('/api/tasks/multi-day/bulk-calculate', authController.authenticateToken, multiDayTaskController.bulkCalculateMultiDayTaskKpi);
console.log('[Server] Multi-day task routes registered:');
console.log('  GET /api/tasks/multi-day');
console.log('  POST /api/tasks/multi-day/calculate-average');
console.log('  POST /api/tasks/multi-day/:taskId/calculate');
console.log('  POST /api/tasks/multi-day/bulk-calculate');

app.post('/api/tasks', authController.authenticateToken, congViecGiaoController.create);
app.post('/api/tasks/upload', authController.authenticateToken, upload.single('file'), congViecGiaoController.uploadFile);
// Test route to verify server is working
app.get('/api/tasks/test-upload-route', (req, res) => {
  res.json({ message: 'Upload route is accessible', timestamp: new Date() });
});

app.post('/api/tasks/upload-multiple', 
  authController.authenticateToken, 
  (req, res, next) => {
    console.log('[Middleware] Before multer - Content-Type:', req.headers['content-type']);
    next();
  },
  (req, res, next) => {
    upload.array('files', 50)(req, res, (err) => {
      if (err) {
        console.error('[Middleware] Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum size is 1GB per file.', error: err.message });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ message: 'Too many files. Maximum is 50 files.', error: err.message });
        }
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      console.log('[Middleware] After multer - Files received:', req.files ? req.files.length : 0);
      next();
    });
  },
  congViecGiaoController.uploadMultipleFiles
);
console.log('[Server] Route registered: POST /api/tasks/upload-multiple');
app.post('/api/tasks/bulk', authController.authenticateToken, congViecGiaoController.bulkCreate);
app.put('/api/tasks/bulk', authController.authenticateToken, congViecGiaoController.bulkUpdate);
app.delete('/api/tasks/bulk', authController.authenticateToken, congViecGiaoController.bulkDelete);
// Routes with specific paths must come before generic :id routes
app.post('/api/tasks/:task_id/accept', authController.authenticateToken, congViecGiaoController.acceptTask);
app.post('/api/tasks/:task_id/attach', authController.authenticateToken, congViecGiaoController.attachFileToTask);
app.post('/api/tasks/:task_id/ai-insights', authController.authenticateToken, congViecGiaoController.generateAiInsights);
app.get('/api/tasks/files/:filename', authController.authenticateToken, congViecGiaoController.downloadFile);
app.delete('/api/tasks/:task_id/files/:file_uri', authController.authenticateToken, congViecGiaoController.deleteFileFromTask);
app.put('/api/tasks/:id/progress', authController.authenticateToken, congViecGiaoController.updateProgress);
app.post('/api/tasks/approve-progress-milestone', authController.authenticateToken, congViecGiaoController.approveProgressMilestone);
app.put('/api/tasks/:id/approve', authController.authenticateToken, congViecGiaoController.approveTask);

// Generic parameterized routes come last
app.get('/api/tasks/:id', authController.authenticateToken, congViecGiaoController.getById);
app.put('/api/tasks/:id', authController.authenticateToken, congViecGiaoController.update);
app.delete('/api/tasks/:id', authController.authenticateToken, congViecGiaoController.delete);

// Additional Task Management routes are now defined above with proper route ordering

// Initialize KPI Auto Calculation Scheduler
const kpiAutoScheduler = require('./services/kpiAutoCalculationScheduler');

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('[Server] Available routes:');
  console.log('  POST /api/tasks/upload-multiple');
  console.log('  POST /api/tasks/:task_id/attach');
  
  // Khởi động scheduled job tự động tính KPI sau 5PM
  // KPI task calculation scheduler đã bị xóa
  console.log('[Server] KPI Auto Calculation Scheduler đã được khởi động');
  
  // Khởi động scheduled job tự động tính KPI cho task nhiều ngày
  kpiAutoScheduler.startMultiDayTaskScheduler();
  console.log('[Server] Multi-Day Task KPI Auto Calculation Scheduler đã được khởi động');
});
