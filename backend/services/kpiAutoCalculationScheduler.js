const cron = require('node-cron');
const { calculateAndPayMultiDayTask } = require('./multiDayTaskService');
const CongViecGiao = require('../models/CongViecGiao');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const AuditLogs = require('../models/AuditLogs');
const EventLogsUser = require('../models/EventLogsUser');

/**
 * Scheduled job tự động tính KPI cho task nhiều ngày khi chuyển sang "Hoàn thành"
 * Chạy lúc 17:30 (5:30 PM) mỗi ngày để đảm bảo sau khi task được duyệt
 */
let multiDayTaskScheduledJob = null;

/**
 * Khởi động scheduled job cho task nhiều ngày
 * Tự động tính KPI và thanh toán cho các task nhiều ngày đã hoàn thành
 */
const startMultiDayTaskScheduler = () => {
  // Dừng job cũ nếu có
  if (multiDayTaskScheduledJob) {
    multiDayTaskScheduledJob.stop();
  }

  // Chạy lúc 17:30 mỗi ngày (sau khi task có thể được duyệt)
  // Cron format: minute hour day month dayOfWeek
  // '30 17 * * *' = 17:30 mỗi ngày
  multiDayTaskScheduledJob = cron.schedule('30 17 * * *', async () => {
    try {
      console.log('[Multi-Day Task Scheduler] ==========================================');
      console.log('[Multi-Day Task Scheduler] Bắt đầu tính KPI tự động cho task nhiều ngày đã hoàn thành');
      console.log('[Multi-Day Task Scheduler] ==========================================');

      // Tìm tất cả task nhiều ngày đã hoàn thành nhưng chưa được thanh toán
      const tasks = await CongViecGiao.find({
        trang_thai: 'Hoàn thành',
        ngay_hoan_thanh_thuc_te: { $exists: true, $ne: null },
        $or: [
          { payment_status: { $exists: false } },
          { payment_status: { $ne: 'completed' } }
        ]
      });

      // Lọc chỉ lấy task nhiều ngày (từ 2 ngày trở lên)
      const multiDayTasks = tasks.filter(task => {
        if (!task.ngay_bat_dau || !task.ngay_ket_thuc_du_kien) {
          return false;
        }
        const startDate = new Date(task.ngay_bat_dau);
        const endDate = new Date(task.ngay_ket_thuc_du_kien);
        const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        return daysDiff >= 1; // Từ 2 ngày trở lên
      });

      console.log(`[Multi-Day Task Scheduler] Tìm thấy ${multiDayTasks.length} task nhiều ngày đã hoàn thành`);

      if (multiDayTasks.length === 0) {
        console.log('[Multi-Day Task Scheduler] Không có task nào cần xử lý');
        return;
      }

      const results = [];
      const errors = [];
      let totalKpi = 0;

      // Tính KPI cho từng task (tự động thanh toán)
      for (const task of multiDayTasks) {
        try {
          console.log(`[Multi-Day Task Scheduler] Đang tính KPI cho task ${task.task_id}...`);
          
          const result = await calculateAndPayMultiDayTask(task.task_id, {
            autoPay: true // Tự động thanh toán
          });

          if (result.success) {
            results.push({
              task_id: task.task_id,
              task_name: task.ten_cong_viec,
              employee_did: result.employee_did,
              kpi_amount: result.kpi_amount,
              payment_success: result.payment_result?.success || false,
              transaction_hash: result.payment_result?.transactionHash || null
            });

            totalKpi += result.kpi_amount || 0;

            // Log audit
            await AuditLogs.create({
              user_did: 'system',
              action: 'AUTO_CALCULATE_MULTI_DAY_TASK_KPI',
              resource_type: 'multi_day_task',
              resource_id: task.task_id,
              status: 'Success',
              timestamp: new Date()
            });

            // Tạo thông báo cho nhân viên nếu có thanh toán
            if (result.payment_result && result.payment_result.success) {
              await EventLogsUser.create({
                user_did: result.employee_did,
                event_type: 'multi_day_task_payment',
                message: `Task nhiều ngày "${task.ten_cong_viec}" đã được tính KPI và thanh toán tự động: ${result.kpi_amount} USDT. Transaction: ${result.payment_result.transactionHash}`,
                resource_type: 'multi_day_task',
                resource_id: task.task_id,
                timestamp: new Date()
              });
            }

            console.log(`[Multi-Day Task Scheduler] ✅ Task ${task.task_id}: ${result.kpi_amount} USDT`);
          } else {
            errors.push({
              task_id: task.task_id,
              error: result.message || result.error || 'Unknown error'
            });
          }
        } catch (error) {
          console.error(`[Multi-Day Task Scheduler] ❌ Lỗi tính KPI cho task ${task.task_id}:`, error.message);
          errors.push({
            task_id: task.task_id,
            error: error.message || 'Unknown error'
          });

          // Log failed audit
          await AuditLogs.create({
            user_did: 'system',
            action: 'AUTO_CALCULATE_MULTI_DAY_TASK_KPI',
            resource_type: 'multi_day_task',
            resource_id: task.task_id,
            status: 'Failed',
            error_message: error.message,
            timestamp: new Date()
          });
        }
      }

      console.log('[Multi-Day Task Scheduler] ==========================================');
      console.log(`[Multi-Day Task Scheduler] Hoàn thành: ${results.length} thành công, ${errors.length} lỗi`);
      console.log(`[Multi-Day Task Scheduler] Tổng KPI: ${totalKpi.toFixed(2)} USDT`);
      console.log('[Multi-Day Task Scheduler] ==========================================');
    } catch (error) {
      console.error('[Multi-Day Task Scheduler] Lỗi nghiêm trọng:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh" // Timezone Việt Nam
  });

  console.log('[Multi-Day Task Scheduler] Đã khởi động scheduled job: Chạy lúc 17:30 mỗi ngày');
};

/**
 * Dừng scheduled job cho task nhiều ngày
 */
const stopMultiDayTaskScheduler = () => {
  if (multiDayTaskScheduledJob) {
    multiDayTaskScheduledJob.stop();
    multiDayTaskScheduledJob = null;
    console.log('[Multi-Day Task Scheduler] Đã dừng scheduled job');
  }
};

module.exports = {
  startMultiDayTaskScheduler,
  stopMultiDayTaskScheduler
};

