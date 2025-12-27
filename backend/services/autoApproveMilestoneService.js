const CongViecGiao = require('../models/CongViecGiao');
const EventLogsUser = require('../models/EventLogsUser');
const AuditLogs = require('../models/AuditLogs');
const { payTaskReward } = require('./payrollContractService');

// Map để lưu các timer: task_id -> timeoutId
const pendingAutoApproveTimers = new Map();

// Hàm tính toán reward (copy từ controller, tính theo cả ngày + giờ)
// Nghiệp vụ:
// - Đúng hạn: thời gian hoàn thành <= deadline → nhận đủ thưởng cơ bản
// - Quá hạn: hoàn thành sau deadline → nhận 50% thưởng cơ bản, không bị phạt
const calculateTaskReward = (mucDoKho, deadline, ngayHoanThanh) => {
  if (!deadline || !ngayHoanThanh) {
    return { tien_thuong: 0, tien_phat: 0 };
  }

  const completedDate = new Date(ngayHoanThanh);
  const deadlineDate = new Date(deadline);
  
  // Đúng hạn nếu hoàn thành <= deadline (tính cả giờ phút)
  const isOnTime = completedDate.getTime() <= deadlineDate.getTime();
  
  // Base reward (thưởng cơ bản)
  const baseReward = {
    'Dễ': 5,
    'Vừa': 15,
    'Khó': 20
  };

  const baseRewardAmount = baseReward[mucDoKho] || baseReward['Vừa'];
  const lateRewardAmount = baseRewardAmount / 2;
  
  if (isOnTime) {
    return { tien_thuong: baseRewardAmount, tien_phat: 0 };
  }

  return { tien_thuong: lateRewardAmount, tien_phat: 0 };
};

// Hàm tự động approve công việc đã hoàn thành nhưng chờ review
const autoApproveMilestone100 = async (taskId) => {
  try {
      console.log(`[Auto Approve] 🔄 Bắt đầu auto-approve (hoàn thành sau 5 phút - TEST MODE) cho task ${taskId}...`);
    const task = await CongViecGiao.findOne({ task_id: taskId });
    if (!task) {
      console.error(`[Auto Approve] ❌ Task ${taskId} not found`);
      return;
    }

    // Chỉ tự động xử lý nếu task đang chờ review và tiến độ 100% và chưa thanh toán
    if (task.trang_thai !== 'Chờ review' || (task.tien_do || 0) < 100) {
      console.log(`[Auto Approve] Task ${taskId} không còn ở trạng thái 'Chờ review 100%', bỏ qua`);
      return;
    }

    const ngayHoanThanhThucTe = task.ngay_hoan_thanh_thuc_te || new Date();

    // Tính toán và thanh toán
    console.log(`[Auto Approve] 💰 Tính toán reward cho task ${taskId}...`);
    console.log(`[Auto Approve] 📅 Deadline: ${task.ngay_ket_thuc_du_kien}`);
    console.log(`[Auto Approve] 📅 Ngày hoàn thành thực tế (dùng để tính reward): ${ngayHoanThanhThucTe}`);
    
    const rewardInfo = calculateTaskReward(
      task.muc_do_kho || 'Vừa',
      task.ngay_ket_thuc_du_kien,
      ngayHoanThanhThucTe
    );
    console.log(`[Auto Approve] 💰 Reward info:`, rewardInfo);

    if (rewardInfo.tien_thuong > 0) {
      console.log(`[Auto Approve] ==========================================`);
      console.log(`[Auto Approve] AUTOMATIC PAYMENT INITIATED (5 minutes timeout - TEST MODE)`);
      console.log(`[Auto Approve] Task ID: ${taskId}`);
      console.log(`[Auto Approve] Employee DID: ${task.nguoi_thuc_hien_did}`);
      console.log(`[Auto Approve] Reward Amount: ${rewardInfo.tien_thuong} USDT`);
      console.log(`[Auto Approve] ==========================================`);

      const paymentResult = await payTaskReward(
        task.nguoi_thuc_hien_did,
        rewardInfo.tien_thuong,
        task.task_id
      );

      if (paymentResult && paymentResult.success) {
        await CongViecGiao.findOneAndUpdate(
          { task_id: taskId },
          { 
            $set: { 
              'payment_transaction_hash': paymentResult.transactionHash,
              'payment_block_number': paymentResult.blockNumber,
              'payment_timestamp': new Date(),
              'payment_status': 'completed',
              'tien_thuong': rewardInfo.tien_thuong,
              'tien_phat': rewardInfo.tien_phat,
              'trang_thai': 'Hoàn thành',
              'ngay_hoan_thanh_thuc_te': ngayHoanThanhThucTe
            }
          }
        );

        // Thông báo cho nhân viên
        await EventLogsUser.create({
          user_did: task.nguoi_thuc_hien_did,
          event_type: 'task_payment_completed',
          message: `✅ Công việc "${task.ten_cong_viec}" đã được tự động phê duyệt và hoàn thành! Bạn đã nhận ${rewardInfo.tien_thuong} USDT vào ví MetaMask. Transaction: ${paymentResult.transactionHash?.slice(0, 10)}...`,
          resource_type: 'cong_viec_giao',
          resource_id: task.task_id,
          timestamp: new Date()
        });

        console.log(`[Auto Approve] ✅ PAYMENT SUCCESSFUL!`);
      } else {
        console.error(`[Auto Approve] ❌ PAYMENT FAILED!`);
        await CongViecGiao.findOneAndUpdate(
          { task_id: taskId },
          { 
            $set: { 
              'payment_status': 'failed',
              'payment_error': paymentResult?.error || paymentResult?.message || 'Unknown payment error',
              'tien_thuong': rewardInfo.tien_thuong,
              'tien_phat': rewardInfo.tien_phat,
              'trang_thai': 'Hoàn thành',
              'ngay_hoan_thanh_thuc_te': ngayHoanThanhThucTe
            }
          }
        );
      }
    }

    // Thông báo cho nhân viên về auto-approve
    await EventLogsUser.create({
      user_did: task.nguoi_thuc_hien_did,
      event_type: 'task_approved',
      message: `Công việc "${task.ten_cong_viec}" đã được tự động phê duyệt sau 5 phút (admin không phê duyệt kịp).`,
      resource_type: 'cong_viec_giao',
      resource_id: task.task_id,
      timestamp: new Date()
    });

    // Log audit
    await AuditLogs.create({
      user_did: 'system_auto_approve',
      action: 'AUTO_APPROVE_TASK',
      resource_type: 'cong_viec_giao',
      resource_id: task.task_id,
      status: 'Success',
      details: 'Tự động phê duyệt công việc sau 5 phút ở trạng thái Chờ review (TEST MODE)',
      timestamp: new Date()
    });

    // Xóa timer khỏi map
    pendingAutoApproveTimers.delete(taskId);

    console.log(`[Auto Approve] ✅ Đã tự động phê duyệt milestone 100% cho task ${taskId}`);
  } catch (error) {
    console.error(`[Auto Approve] ❌ Lỗi khi tự động phê duyệt task ${taskId}:`, error);
    // Xóa timer khỏi map ngay cả khi lỗi
    pendingAutoApproveTimers.delete(taskId);
  }
};

// Tạo timer để tự động approve sau 5 phút (TEST MODE - thay đổi từ 2 giờ)
const scheduleAutoApprove = (taskId, submittedAt = null) => {
  // Nếu đã có timer cho task này, hủy timer cũ
  if (pendingAutoApproveTimers.has(taskId)) {
    clearTimeout(pendingAutoApproveTimers.get(taskId));
    console.log(`[Auto Approve] 🔄 Đã hủy timer cũ cho task ${taskId}, tạo timer mới`);
  }

  // Thời gian auto-approve: 5 phút (để test) - Thay đổi từ 2 giờ
  const AUTO_APPROVE_MS = 5 * 60 * 1000; // 5 phút = 5 * 60 * 1000 milliseconds
  // Để quay lại 2 giờ: const AUTO_APPROVE_MS = 2 * 60 * 60 * 1000;
  let remainingTime = AUTO_APPROVE_MS;
  let submittedTime = submittedAt ? new Date(submittedAt) : new Date();
  
  if (submittedAt) {
    const elapsed = Date.now() - submittedTime.getTime();
    remainingTime = Math.max(0, AUTO_APPROVE_MS - elapsed);
    console.log(`[Auto Approve] 📅 Task ${taskId} đã submit lúc: ${submittedTime.toISOString()}, đã trôi qua: ${Math.ceil(elapsed / 1000 / 60)} phút`);
  }

  if (remainingTime <= 0) {
    // Nếu đã quá thời gian, approve ngay lập tức
    console.log(`[Auto Approve] ⚡ Task ${taskId} đã quá thời gian auto-approve (5 phút), approve ngay lập tức`);
    autoApproveMilestone100(taskId);
    return;
  }

  // Tính thời gian sẽ approve
  const approveAt = new Date(Date.now() + remainingTime);
  console.log(`[Auto Approve] ⏰ Task ${taskId} sẽ được auto-approve lúc: ${approveAt.toISOString()}`);

  // Tạo timer mới
  const timeoutId = setTimeout(() => {
    console.log(`[Auto Approve] ⏰ Timer hết hạn cho task ${taskId}, bắt đầu auto-approve...`);
    autoApproveMilestone100(taskId);
  }, remainingTime);

  pendingAutoApproveTimers.set(taskId, timeoutId);
  const minutesRemaining = Math.ceil(remainingTime / 1000 / 60);
  const secondsRemaining = Math.ceil((remainingTime % (60 * 1000)) / 1000);
  console.log(`[Auto Approve] ✅ Đã tạo timer tự động phê duyệt cho task ${taskId}, sẽ approve sau ${minutesRemaining} phút ${secondsRemaining} giây`);
};

// Hủy timer auto-approve (khi admin đã approve thủ công)
const cancelAutoApprove = (taskId) => {
  if (pendingAutoApproveTimers.has(taskId)) {
    clearTimeout(pendingAutoApproveTimers.get(taskId));
    pendingAutoApproveTimers.delete(taskId);
    console.log(`[Auto Approve] ❌ Đã hủy timer tự động phê duyệt cho task ${taskId} (admin đã phê duyệt)`);
  }
};

// Lấy danh sách các task đang chờ auto-approve (để debug)
const getPendingAutoApproveTasks = () => {
  return Array.from(pendingAutoApproveTimers.keys());
};

// Khôi phục các timer khi server khởi động lại
const restorePendingTimers = async () => {
  try {
    console.log(`[Auto Approve] 🔄 Đang khôi phục các timer auto-approve (5 phút - TEST MODE)...`);
    
    // Tìm tất cả các task đang ở trạng thái Chờ review, tiến độ 100% và chưa thanh toán xong
    const pendingTasks = await CongViecGiao.find({
      trang_thai: 'Chờ review',
      tien_do: { $gte: 100 },
      $or: [
        { payment_status: { $exists: false } },
        { payment_status: { $ne: 'completed' } }
      ]
    });

    console.log(`[Auto Approve] 📋 Tìm thấy ${pendingTasks.length} task đang chờ auto-approve (Chờ review 100%)`);

    for (const task of pendingTasks) {
      const submittedAt = task.ngay_hoan_thanh_thuc_te || task.updatedAt || task.createdAt;
      scheduleAutoApprove(task.task_id, submittedAt);
    }

    console.log(`[Auto Approve] ✅ Đã khôi phục ${pendingAutoApproveTimers.size} timer`);
  } catch (error) {
    console.error(`[Auto Approve] ❌ Lỗi khi khôi phục timer:`, error);
  }
};

module.exports = {
  scheduleAutoApprove,
  cancelAutoApprove,
  autoApproveMilestone100,
  getPendingAutoApproveTasks,
  restorePendingTimers
};

