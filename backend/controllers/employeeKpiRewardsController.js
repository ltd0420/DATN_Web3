const CongViecGiao = require('../models/CongViecGiao');
const HoSoNhanVien = require('../models/HoSoNhanVien');

/**
 * GET /api/employee/kpi-rewards/:employeeDid
 * Lấy tổng KPI thưởng của nhân viên từ các task đã hoàn thành
 */
const getEmployeeKpiRewards = async (req, res) => {
  try {
    const { employeeDid } = req.params;

    // Kiểm tra quyền truy cập - chỉ nhân viên đó mới được xem
    if (req.user.employee_did !== employeeDid) {
      return res.status(403).json({ 
        success: false,
        message: 'Bạn không có quyền xem KPI thưởng của nhân viên khác' 
      });
    }

    // Lấy tất cả các task đã hoàn thành và có tiền thưởng
    const completedTasks = await CongViecGiao.find({
      nguoi_thuc_hien_did: employeeDid,
      trang_thai: 'Hoàn thành',
      tien_thuong: { $gt: 0 }
    })
    .sort({ ngay_hoan_thanh_thuc_te: -1 })
    .select('task_id ten_cong_viec tien_thuong tien_phat payment_transaction_hash payment_status payment_timestamp ngay_hoan_thanh_thuc_te ngay_ket_thuc_du_kien');

    // Tính tổng
    const totalReward = completedTasks.reduce((sum, task) => sum + (task.tien_thuong || 0), 0);
    const totalPenalty = completedTasks.reduce((sum, task) => sum + (task.tien_phat || 0), 0);
    const netReward = totalReward - totalPenalty;

    // Đếm số task đã được thanh toán
    const paidTasksCount = completedTasks.filter(task => 
      task.payment_transaction_hash && task.payment_status === 'completed'
    ).length;

    // Lấy thông tin nhân viên
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid })
      .select('ho_ten employee_did');

    res.json({
      success: true,
      data: {
        employee: {
          employee_did: employeeDid,
          ho_ten: employee?.ho_ten || 'N/A'
        },
        summary: {
          totalReward,
          totalPenalty,
          netReward,
          totalTasks: completedTasks.length,
          paidTasksCount,
          pendingTasksCount: completedTasks.length - paidTasksCount
        },
        tasks: completedTasks.map(task => ({
          task_id: task.task_id,
          ten_cong_viec: task.ten_cong_viec,
          tien_thuong: task.tien_thuong,
          tien_phat: task.tien_phat,
          payment_transaction_hash: task.payment_transaction_hash,
          payment_status: task.payment_status,
          payment_timestamp: task.payment_timestamp,
          ngay_hoan_thanh_thuc_te: task.ngay_hoan_thanh_thuc_te,
          ngay_ket_thuc_du_kien: task.ngay_ket_thuc_du_kien
        }))
      }
    });
  } catch (error) {
    console.error('[getEmployeeKpiRewards] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy thông tin KPI thưởng'
    });
  }
};

module.exports = {
  getEmployeeKpiRewards
};

