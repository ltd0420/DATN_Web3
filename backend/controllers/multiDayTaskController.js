const multiDayTaskService = require('../services/multiDayTaskService');
const AuditLogs = require('../models/AuditLogs');
const EventLogsUser = require('../models/EventLogsUser');
const RolesPermissions = require('../models/RolesPermissions');

/**
 * Lấy danh sách task nhiều ngày (từ 2 ngày trở lên)
 * GET /api/tasks/multi-day
 */
const getMultiDayTasks = async (req, res) => {
  try {
    // Kiểm tra quyền truy cập
    const userRole = await RolesPermissions.findOne({ role_id: req.user?.role_id });
    const isAdmin = userRole && (
      userRole.ten_vai_tro === 'Super Admin' ||
      userRole.ten_vai_tro === 'Manager'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'Chỉ Super Admin hoặc Manager mới có quyền xem danh sách task nhiều ngày'
      });
    }

    const filters = {
      employee_did: req.query.employee_did,
      trang_thai: req.query.trang_thai,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const tasks = await multiDayTaskService.getMultiDayTasks(filters);

    res.json({
      success: true,
      message: 'Lấy danh sách task nhiều ngày thành công',
      data: {
        total: tasks.length,
        tasks
      }
    });
  } catch (error) {
    console.error('[getMultiDayTasks] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách task nhiều ngày',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Tính toán và thanh toán KPI cho task nhiều ngày
 * POST /api/tasks/multi-day/:taskId/calculate
 */
const calculateMultiDayTaskKpi = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { auto_pay = true } = req.body;

    // Kiểm tra quyền truy cập
    const userRole = await RolesPermissions.findOne({ role_id: req.user?.role_id });
    const isAdmin = userRole && (
      userRole.ten_vai_tro === 'Super Admin' ||
      userRole.ten_vai_tro === 'Manager'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'Chỉ Super Admin hoặc Manager mới có quyền tính KPI cho task nhiều ngày'
      });
    }

    // Tính toán và thanh toán
    const result = await multiDayTaskService.calculateAndPayMultiDayTask(taskId, {
      autoPay: auto_pay === true || auto_pay === 'true'
    });

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did || 'system',
      action: 'CALCULATE_MULTI_DAY_TASK_KPI',
      resource_type: 'multi_day_task',
      resource_id: taskId,
      status: result.success ? 'Success' : 'Failed',
      error_message: result.error || null,
      timestamp: new Date()
    });

    // Tạo thông báo cho nhân viên nếu có thanh toán
    if (result.success && result.payment_result && result.payment_result.success) {
      await EventLogsUser.create({
        user_did: result.employee_did,
        event_type: 'multi_day_task_payment',
        message: `Task nhiều ngày "${result.task_id}" đã được tính KPI và thanh toán: ${result.kpi_amount} USDT. Transaction: ${result.payment_result.transactionHash}`,
        resource_type: 'multi_day_task',
        resource_id: taskId,
        timestamp: new Date()
      });
    }

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Tính KPI và thanh toán thành công',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || result.error || 'Tính KPI thất bại',
        data: result
      });
    }
  } catch (error) {
    console.error('[calculateMultiDayTaskKpi] Error:', error);

    // Log failed audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'CALCULATE_MULTI_DAY_TASK_KPI',
      resource_type: 'multi_day_task',
      resource_id: req.params.taskId,
      status: 'Failed',
      error_message: error.message,
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi tính KPI cho task nhiều ngày',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Tính toán và thanh toán KPI cho nhiều task nhiều ngày cùng lúc
 * POST /api/tasks/multi-day/bulk-calculate
 */
const bulkCalculateMultiDayTaskKpi = async (req, res) => {
  try {
    const { task_ids, auto_pay = true } = req.body;

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({
        message: 'task_ids là mảng bắt buộc và không được rỗng'
      });
    }

    // Kiểm tra quyền truy cập
    const userRole = await RolesPermissions.findOne({ role_id: req.user?.role_id });
    const isAdmin = userRole && (
      userRole.ten_vai_tro === 'Super Admin' ||
      userRole.ten_vai_tro === 'Manager'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'Chỉ Super Admin hoặc Manager mới có quyền tính KPI cho nhiều task'
      });
    }

    const results = [];
    const errors = [];

    for (const taskId of task_ids) {
      try {
        const result = await multiDayTaskService.calculateAndPayMultiDayTask(taskId, {
          autoPay: auto_pay === true || auto_pay === 'true'
        });

        results.push({
          task_id: taskId,
          ...result
        });

        // Log audit
        await AuditLogs.create({
          user_did: req.user?.employee_did || 'system',
          action: 'BULK_CALCULATE_MULTI_DAY_TASK_KPI',
          resource_type: 'multi_day_task',
          resource_id: taskId,
          status: result.success ? 'Success' : 'Failed',
          error_message: result.error || null,
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`[bulkCalculateMultiDayTaskKpi] Lỗi với task ${taskId}:`, error);
        errors.push({
          task_id: taskId,
          error: error.message || 'Unknown error'
        });
      }
    }

    const totalKpi = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.kpi_amount || 0), 0);

    res.json({
      success: true,
      message: `Đã tính KPI cho ${results.length} task${errors.length > 0 ? `, ${errors.length} lỗi` : ''}`,
      data: {
        total_tasks: task_ids.length,
        success_count: results.length,
        error_count: errors.length,
        total_kpi: parseFloat(totalKpi.toFixed(2)),
        results,
        errors
      }
    });
  } catch (error) {
    console.error('[bulkCalculateMultiDayTaskKpi] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi tính KPI cho nhiều task',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Tính tỷ lệ hoàn thành trung bình cho nhiều công việc trong kỳ
 * POST /api/tasks/multi-day/calculate-average
 * Body: { employee_did, start_date, end_date, auto_pay }
 */
const calculateAverageCompletionRate = async (req, res) => {
  try {
    const { employee_did, start_date, end_date, auto_pay = false } = req.body;

    if (!employee_did || !start_date || !end_date) {
      return res.status(400).json({
        message: 'employee_did, start_date và end_date là bắt buộc',
        example: {
          employee_did: 'uuid-v7',
          start_date: '2025-01-01',
          end_date: '2025-01-31',
          auto_pay: false
        }
      });
    }

    // Kiểm tra quyền truy cập
    const userRole = await RolesPermissions.findOne({ role_id: req.user?.role_id });
    const isAdmin = userRole && (
      userRole.ten_vai_tro === 'Super Admin' ||
      userRole.ten_vai_tro === 'Manager'
    );

    if (!isAdmin && req.user?.employee_did !== employee_did) {
      return res.status(403).json({
        message: 'Bạn chỉ có thể tính KPI cho chính mình'
      });
    }

    // Tính tỷ lệ hoàn thành trung bình
    const result = await multiDayTaskService.calculateAverageCompletionRateForPeriod(
      employee_did,
      start_date,
      end_date
    );

    // Thanh toán nếu được yêu cầu
    let paymentResult = null;
    if (auto_pay === true || auto_pay === 'true') {
      if (result.total_kpi > 0) {
        try {
          const HoSoNhanVien = require('../models/HoSoNhanVien');
          const employee = await HoSoNhanVien.findOne({ employee_did });
          if (employee && employee.walletAddress) {
            const { payTaskReward } = require('../services/payrollContractService');
            const taskId = `kpi_period_${employee_did}_${start_date}_${end_date}`;
            paymentResult = await payTaskReward(employee_did, result.total_kpi, taskId);
          }
        } catch (paymentError) {
          console.error('[calculateAverageCompletionRate] Payment error:', paymentError);
          paymentResult = {
            success: false,
            error: paymentError.message
          };
        }
      }
    }

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did || employee_did,
      action: 'CALCULATE_AVERAGE_COMPLETION_RATE',
      resource_type: 'multi_day_task',
      resource_id: `period_${employee_did}_${start_date}_${end_date}`,
      status: 'Success',
      timestamp: new Date()
    });

    // Tạo thông báo cho nhân viên nếu có thanh toán
    if (paymentResult && paymentResult.success) {
      await EventLogsUser.create({
        user_did: employee_did,
        event_type: 'kpi_payment',
        message: `KPI trung bình từ ${start_date} đến ${end_date} đã được tính và thanh toán: ${result.total_kpi} USDT. Transaction: ${paymentResult.transactionHash}`,
        resource_type: 'multi_day_task',
        resource_id: `period_${employee_did}_${start_date}_${end_date}`,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Tính tỷ lệ hoàn thành trung bình thành công',
      data: {
        ...result,
        payment_result: paymentResult
      }
    });
  } catch (error) {
    console.error('[calculateAverageCompletionRate] Error:', error);

    // Log failed audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'CALCULATE_AVERAGE_COMPLETION_RATE',
      resource_type: 'multi_day_task',
      resource_id: `period_${req.body?.employee_did}_${req.body?.start_date}_${req.body?.end_date}`,
      status: 'Failed',
      error_message: error.message,
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi tính tỷ lệ hoàn thành trung bình',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  getMultiDayTasks,
  calculateMultiDayTaskKpi,
  bulkCalculateMultiDayTaskKpi,
  calculateAverageCompletionRate
};

