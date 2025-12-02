import axios from 'axios';
import authService from './authService';
import io from 'socket.io-client';

const DEFAULT_API_BASE = (() => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/api';
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = window.location.hostname || 'localhost';
  const fallbackPort = protocol === 'https:' ? 443 : 5000;
  const configuredPort = process.env.REACT_APP_API_PORT || fallbackPort;
  const portIsDefault =
    (protocol === 'https:' && Number(configuredPort) === 443) ||
    (protocol === 'http:' && Number(configuredPort) === 80);
  const portSegment = portIsDefault ? '' : `:${configuredPort}`;

  return `${protocol}//${hostname}${portSegment}/api`;
})();

const API_BASE_URL = process.env.REACT_APP_API_URL || DEFAULT_API_BASE;

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Don't set Content-Type for FormData - let axios set it automatically with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token expiration
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          authService.logout();
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );

    // Initialize Socket.IO connection
    this.socket = null;
    this.notificationCallbacks = [];
  }

  // Generic HTTP methods for custom endpoints
  async get(endpoint, params = {}) {
    const response = await this.client.get(endpoint, { params });
    return response;
  }

  async post(endpoint, data = {}) {
    const response = await this.client.post(endpoint, data);
    return response;
  }

  async put(endpoint, data = {}) {
    const response = await this.client.put(endpoint, data);
    return response;
  }

  async delete(endpoint) {
    const response = await this.client.delete(endpoint);
    return response;
  }

  // Initialize Socket.IO connection
  initSocket(userDid) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(API_BASE_URL.replace('/api', ''), {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to notification server');
      this.socket.emit('join', userDid);
    });

    this.socket.on('notification', (notification) => {
      console.log('Received notification:', notification);
      this.notificationCallbacks.forEach(callback => callback(notification));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from notification server:', reason);
      // Don't automatically reconnect to avoid loops
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  // Add notification callback
  onNotification(callback) {
    this.notificationCallbacks.push(callback);
  }

  // Remove notification callback
  offNotification(callback) {
    this.notificationCallbacks = this.notificationCallbacks.filter(cb => cb !== callback);
  }

  // Disconnect socket
  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Employee Profile
  async getEmployeeProfile(employeeDid) {
    const response = await this.client.get(`/employees/${employeeDid}`);
    return response.data;
  }

  async updateEmployeeProfile(employeeDid, data) {
    const response = await this.client.put(`/employees/${employeeDid}`, data);
    return response.data;
  }

  // Update user wallet address
  async updateUserWallet(employeeDid, walletAddress) {
    const response = await this.client.put(`/employees/${employeeDid}/wallet`, { walletAddress });
    return response.data;
  }

  // Attendance
  async getAttendanceByEmployee(employeeDid, params = {}) {
    const response = await this.client.get(`/attendance/employee/${employeeDid}`, { params });
    return response.data;
  }

  async getAllAttendance(params = {}) {
    const response = await this.client.get('/attendance', { params });
    return response.data;
  }

  async getAttendanceReport(params = {}) {
    const response = await this.client.get('/attendance/report', { params });
    return response.data;
  }

  async checkIn(data) {
    const response = await this.client.post('/attendance/checkin', data);
    return response.data;
  }

  async checkOut(data) {
    const response = await this.client.post('/attendance/checkout', data);
    return response.data;
  }

  async reportMissedCheckout(data) {
    const response = await this.client.post('/attendance/report-missed-checkout', data);
    return response.data;
  }

  async approveMissedCheckout(recordId, data) {
    const response = await this.client.post(`/attendance/admin/missed-checkout/${recordId}`, data);
    return response.data;
  }

  async payAttendanceRecord(recordId) {
    const response = await this.client.post(`/attendance/${recordId}/pay`);
    return response.data;
  }


  // QR Authentication with Blockchain support
  async getQrCode(employeeDid) {
    const response = await this.client.get(`/qr/employee/${employeeDid}`);
    return response.data;
  }

  async generateNewQrCode(employeeDid, walletAddress) {
    const response = await this.client.post(`/qr/generate/${employeeDid}`, { walletAddress });
    return response.data;
  }

  async validateQrForLogin(qrData) {
    const response = await this.client.post('/qr/validate-login', qrData);
    return response.data;
  }

  // Get smart contract logs for attendance record
  async getSmartContractLogsForAttendance(recordId) {
    const response = await this.client.get(`/logs/contracts/attendance/${recordId}`);
    return response.data;
  }

  // Notifications & Logs
  async getNotifications(employeeDid) {
    const response = await this.client.get(`/logs/events/${employeeDid}`);
    return response.data;
  }

  // Support chat & messages
  async getAllEvents() {
    const response = await this.client.get('/logs/events');
    return response.data;
  }

  async getSupportMessages(employeeDid) {
    const response = await this.client.get(`/logs/events/${employeeDid}`);
    const data = response.data || [];
    return data
      .filter(e =>
        e.event_type === 'support_employee' ||
        e.event_type === 'support_admin' ||
        e.event_type === 'support_request'
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async sendSupportMessage(employeeDid, message, from = 'employee') {
    const eventType = from === 'admin' ? 'support_admin' : 'support_employee';
    const payload = {
      user_did: employeeDid,
      event_type: eventType,
      message,
      resource_type: 'support',
      resource_id: null,
      is_read: false,
      timestamp: new Date().toISOString()
    };
    const response = await this.client.post('/logs/events', payload);
    return response.data;
  }

  async markNotificationAsRead(notificationId) {
    const response = await this.client.put(`/logs/events/${notificationId}`, { is_read: true });
    return response.data;
  }

  // Departments
  async getDepartments() {
    const response = await this.client.get('/departments');
    return response.data;
  }

  async createDepartment(departmentData) {
    const response = await this.client.post('/departments', departmentData);
    return response.data;
  }

  async updateDepartment(departmentId, departmentData) {
    const response = await this.client.put(`/departments/${departmentId}`, departmentData);
    return response.data;
  }

  async deleteDepartment(departmentId) {
    const response = await this.client.delete(`/departments/${departmentId}`);
    return response.data;
  }

  // Employees
  async getEmployees() {
    const response = await this.client.get('/employees');
    return response.data;
  }

  async createEmployee(employeeData) {
    const response = await this.client.post('/employees', employeeData);
    return response.data;
  }

  async updateEmployee(employeeId, employeeData) {
    const response = await this.client.put(`/employees/${employeeId}`, employeeData);
    return response.data;
  }

  async deleteEmployee(employeeId) {
    const response = await this.client.delete(`/employees/${employeeId}`);
    return response.data;
  }

  // Audit Logs
  async getAuditLogs(employeeDid) {
    const response = await this.client.get(`/logs/audit/${employeeDid}`);
    return response.data;
  }

  // Payroll Contract Info
  async getPayrollContractInfo() {
    try {
      const response = await this.client.get('/payroll/contract-info');
      return response.data;
    } catch (error) {
      console.error('[apiService] Error in getPayrollContractInfo:', error);
      throw error;
    }
  }

  // Consent Management
  async giveConsent(consentData) {
    const response = await this.client.post('/consent', consentData);
    return response.data;
  }

  async revokeConsent(consentId) {
    const response = await this.client.put(`/consent/${consentId}/revoke`);
    return response.data;
  }

  async checkConsentValidity(consentId) {
    const response = await this.client.get(`/consent/${consentId}/valid`);
    return response.data;
  }

  async checkActiveConsent(employeeDid, consentType) {
    const response = await this.client.get(`/consent/employee/${employeeDid}/type/${consentType}/active`);
    return response.data;
  }

  async getEmployeeConsents(employeeDid) {
    const response = await this.client.get(`/consent/employee/${employeeDid}`);
    return response.data;
  }

  async getConsentDetails(consentId) {
    const response = await this.client.get(`/consent/${consentId}`);
    return response.data;
  }

  async deleteReadNotifications(employeeDid) {
    const response = await this.client.delete(`/logs/events/read/${employeeDid}`);
    return response.data;
  }

  async deleteNotification(notificationId) {
    console.log('[API] Deleting notification with ID:', notificationId);
    const url = `/logs/events/delete/${notificationId}`;
    console.log('[API] Delete URL:', url);
    const response = await this.client.delete(url);
    return response.data;
  }

  async deleteAllNotifications(employeeDid) {
    const response = await this.client.delete(`/logs/events/all/${employeeDid}`);
    return response.data;
  }

  // Department Information
  async getDepartments() {
    const response = await this.client.get('/departments');
    return response.data;
  }

  async getAllDepartments() {
    const response = await this.client.get('/departments');
    return response.data;
  }

  async getDepartmentById(departmentId) {
    const response = await this.client.get(`/departments/${departmentId}`);
    return response.data;
  }

  async getEmployeesByDepartment(departmentId) {
    const response = await this.client.get(`/employees/department/${departmentId}`);
    return response.data;
  }

  async assignEmployeeToDepartment(employeeDid, departmentId) {
    const response = await this.client.post(`/departments/${departmentId}/assign-employee`, { employee_did: employeeDid });
    return response.data;
  }

  async removeEmployeeFromDepartment(employeeDid) {
    const response = await this.client.delete(`/departments/remove-employee/${employeeDid}`);
    return response.data;
  }

  async getAllEmployees() {
    const response = await this.client.get('/employees');
    return response.data;
  }

  async getEmployeeByWallet(walletAddress) {
    const normalized = walletAddress?.trim();
    const response = await this.client.get(`/employees/wallet/${normalized}`);
    return response.data;
  }

  // Task Management
  async getTasksByEmployee(employeeDid) {
    const response = await this.client.get(`/tasks/employee/${employeeDid}`);
    return response.data;
  }

  async getPendingTasksByEmployee(employeeDid) {
    const response = await this.client.get(`/tasks/employee/${employeeDid}/pending`);
    return response.data;
  }

  async acceptTask(taskId) {
    const response = await this.client.post(`/tasks/${taskId}/accept`);
    return response.data;
  }

  async getAllTasks() {
    const response = await this.client.get('/tasks');
    return response.data;
  }

  async getTaskById(taskId) {
    const response = await this.client.get(`/tasks/${taskId}`);
    return response.data;
  }

  async createTask(taskData) {
    const response = await this.client.post('/tasks', taskData);
    return response.data;
  }

  async updateTask(taskId, taskData) {
    const response = await this.client.put(`/tasks/${taskId}`, taskData);
    return response.data;
  }

  async updateTaskProgress(taskId, progressData) {
    // progressData should be: { tien_do: number, note: string, files: Array<FileMeta> }
    const response = await this.client.put(`/tasks/${taskId}/progress`, progressData);
    return response.data;
  }

  async approveTask(taskId, approvalData) {
    const response = await this.client.put(`/tasks/${taskId}/approve`, approvalData);
    return response.data;
  }

  async approveProgressMilestone(taskId, milestone, approve, adminNote) {
    // approve: true/false, milestone: 25|50|75|100
    const response = await this.client.post('/tasks/approve-progress-milestone', {
      task_id: taskId,
      milestone: milestone,
      approve: approve,
      admin_note: adminNote
    });
    return response.data;
  }

  async deleteTask(taskId) {
    const response = await this.client.delete(`/tasks/${taskId}`);
    return response.data;
  }

  async getTaskStats() {
    const response = await this.client.get('/tasks/stats');
    return response.data;
  }

  async getTasksByStatus(status) {
    const response = await this.client.get(`/tasks/status/${status}`);
    return response.data;
  }

  async getTasksByPriority(priority) {
    const response = await this.client.get(`/tasks/priority/${priority}`);
    return response.data;
  }

  async getTasksByDepartment(departmentId) {
    const response = await this.client.get(`/tasks/department/${departmentId}`);
    return response.data;
  }

  async getOverdueTasks() {
    const response = await this.client.get('/tasks/overdue');
    return response.data;
  }

  // File upload
  async uploadMultipleFiles(formData) {
    // Don't set Content-Type header - axios will set it automatically with boundary for FormData
    const response = await this.client.post('/tasks/upload-multiple', formData);
    return response.data;
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    // Don't set Content-Type header - axios will set it automatically with boundary for FormData
    const response = await this.client.post('/tasks/upload', formData);
    return response.data;
  }

  async attachFileToTask(taskId, fileData) {
    // Encode taskId to handle any special characters
    const encodedTaskId = encodeURIComponent(taskId);
    const response = await this.client.post(`/tasks/${encodedTaskId}/attach`, fileData);
    return response.data;
  }

  async downloadFile(filename) {
    const response = await this.client.get(`/tasks/files/${filename}`, {
      responseType: 'blob',
    });
    return response;
  }

  async deleteFileFromTask(taskId, fileUri) {
    const response = await this.client.delete(`/tasks/${taskId}/files/${encodeURIComponent(fileUri)}`);
    return response.data;
  }

  async getTaskById(taskId) {
    const response = await this.client.get(`/tasks/${taskId}`);
    return response.data;
  }

  // AI Insights
  async generateAiInsights(taskId) {
    const response = await this.client.post(`/tasks/${taskId}/ai-insights`);
    return response.data;
  }

  // Bulk operations
  async bulkCreateTasks(tasks) {
    const response = await this.client.post('/tasks/bulk', { tasks });
    return response.data;
  }

  async bulkUpdateTasks(taskIds, updates) {
    const response = await this.client.put('/tasks/bulk', { task_ids: taskIds, updates });
    return response.data;
  }

  async bulkDeleteTasks(taskIds) {
    const response = await this.client.delete('/tasks/bulk', { data: { task_ids: taskIds } });
    return response.data;
  }

  // Enhanced statistics
  async getDetailedTaskStats() {
    const response = await this.client.get('/tasks/stats/detailed');
    return response.data;
  }


  // Smart contract logs
  async getAttendanceLogs(employeeDid) {
    const response = await this.client.get(`/logs/contracts/attendance/${employeeDid}`);
    return response.data || [];
  }

  // Multi-day Task APIs
  async getMultiDayTasks(params = {}) {
    const response = await this.client.get('/tasks/multi-day', { params });
    return response.data?.data || response.data || { total: 0, tasks: [] };
  }

  async calculateMultiDayTaskKpi(taskId, autoPay = true) {
    try {
      const response = await this.client.post(`/tasks/multi-day/${taskId}/calculate`, { auto_pay: autoPay });
      const result = response.data?.data || response.data;
      // Đảm bảo có field success nếu response thành công
      if (response.status === 200 && !result.hasOwnProperty('success')) {
        result.success = true;
      }
      return result;
    } catch (error) {
      console.error('API Error in calculateMultiDayTaskKpi:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Lỗi khi tính KPI';
      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      };
    }
  }

  async bulkCalculateMultiDayTaskKpi(taskIds, autoPay = true) {
    try {
      const response = await this.client.post('/tasks/multi-day/bulk-calculate', {
        task_ids: taskIds,
        auto_pay: autoPay
      });
      // Trả về data từ response, có thể là response.data.data hoặc response.data
      const result = response.data?.data || response.data;
      // Đảm bảo có field success nếu response thành công
      if (response.status === 200 && !result.hasOwnProperty('success')) {
        result.success = true;
      }
      return result;
    } catch (error) {
      console.error('API Error in bulkCalculateMultiDayTaskKpi:', error);
      // Trả về object có format giống với response thành công nhưng success = false
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Lỗi khi tính KPI';
      return {
        success: false,
        message: errorMessage,
        errors: error.response?.data?.errors || []
      };
    }
  }

  // KPI Task Calculation - Tính KPI dựa trên hoàn thành công việc
  async calculateDailyKpi(employeeDid, date, autoPay = false) {
    const response = await this.client.post('/kpi/task-calculation/daily', {
      employee_did: employeeDid,
      date,
      auto_pay: autoPay
    });
    return response.data;
  }

  async calculateKpiForRange(employeeDid, startDate, endDate, autoPay = false) {
    const response = await this.client.post('/kpi/task-calculation/range', {
      employee_did: employeeDid,
      start_date: startDate,
      end_date: endDate,
      auto_pay: autoPay
    });
    return response.data;
  }

  async calculateKpiForAllEmployees(date = null) {
    const response = await this.client.post('/kpi/task-calculation/auto-all', {
      date: date || new Date().toISOString().split('T')[0]
    });
    return response.data;
  }

  // Calculate average completion rate for multi-day tasks in a period
  async calculateAverageCompletionRate(employeeDid, startDate, endDate, autoPay = false) {
    const response = await this.client.post('/tasks/multi-day/calculate-average', {
      employee_did: employeeDid,
      start_date: startDate,
      end_date: endDate,
      auto_pay: autoPay
    });
    return response.data;
  }

  // Employee KPI Rewards - Lấy tổng KPI thưởng của nhân viên
  async getEmployeeKpiRewards(employeeDid) {
    const response = await this.client.get(`/employee/kpi-rewards/${employeeDid}`);
    return response.data;
  }
}

export default new ApiService();
