// Using native Date instead of moment for better compatibility
// const moment = require('moment');
const CongViecGiao = require('../models/CongViecGiao');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const ChamCong = require('../models/ChamCong');
const { payTaskReward } = require('./payrollContractService');

// Optional model - only require if it exists
let DanhGiaKpi;
try {
  DanhGiaKpi = require('../models/DanhGiaKpi');
} catch (e) {
  DanhGiaKpi = null;
}

const REWARD_RATE = 2; // 2 USDT/giờ
const CUTOFF_TIME = 20; // 20:00 (8:00 PM) - mốc deadline

/**
 * Kiểm tra task có phải là task 1 ngày không
 * Công việc 1 ngày: khi ngay_bat_dau và ngay_ket_thuc_du_kien là cùng ngày
 * @param {Object} task - Task object
 * @returns {Boolean} true nếu task là 1 ngày
 */
const isSingleDayTask = (task) => {
  if (!task.ngay_bat_dau || !task.ngay_ket_thuc_du_kien) {
    return false;
  }

  const startDate = new Date(task.ngay_bat_dau);
  const endDate = new Date(task.ngay_ket_thuc_du_kien);
  
  // Chuẩn hóa về cùng ngày (bỏ giờ, phút, giây)
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  return startDate.getTime() === endDate.getTime();
};

/**
 * Kiểm tra task có phải là task nhiều ngày (≥ 2 ngày) không
 * Công việc nhiều ngày: khi ngay_ket_thuc_du_kien lớn hơn ngay_bat_dau + 1 ngày
 * @param {Object} task - Task object
 * @returns {Boolean} true nếu task từ 2 ngày trở lên
 */
const isMultiDayTask = (task) => {
  if (!task.ngay_bat_dau || !task.ngay_ket_thuc_du_kien) {
    return false;
  }

  const startDate = new Date(task.ngay_bat_dau);
  const endDate = new Date(task.ngay_ket_thuc_du_kien);
  
  // Chuẩn hóa về cùng ngày
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Nếu endDate > startDate + 1 ngày thì là nhiều ngày (≥ 2 ngày)
  return daysDiff >= 1;
};

/**
 * Kiểm tra công việc có được admin duyệt không
 * @param {Object} task - Task object
 * @returns {Promise<Boolean>} true nếu được duyệt
 */
const isTaskApproved = async (task) => {
  // Kiểm tra trạng thái task
  if (task.trang_thai !== 'Hoàn thành' || !task.ngay_hoan_thanh_thuc_te) {
    return false;
  }

  // Nếu có lien_ket_kpi_id, kiểm tra trạng thái đánh giá KPI
  if (task.lien_ket_kpi_id && DanhGiaKpi) {
    const danhGia = await DanhGiaKpi.findOne({ kpi_id: task.lien_ket_kpi_id });
    if (danhGia && danhGia.trang_thai === 'Đã phê duyệt') {
      return true;
    }
    // Nếu có lien_ket_kpi_id nhưng chưa được duyệt, coi như chưa duyệt
    if (danhGia && danhGia.trang_thai !== 'Đã phê duyệt') {
      return false;
    }
  }

  // Nếu không có lien_ket_kpi_id, coi như đã duyệt nếu trạng thái là "Hoàn thành"
  return true;
};

/**
 * Tính tổng giờ làm việc thực tế từ ngay_bat_dau đến ngay_hoan_thanh_thuc_te
 * Nếu hoàn thành sau 20:00 của deadline, chỉ tính đến 20:00 của ngày deadline
 * @param {String} employeeDid - ID nhân viên
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Date} completionDate - Ngày hoàn thành thực tế
 * @param {Date} deadline - Deadline (20:00 của ngay_ket_thuc_du_kien)
 * @returns {Promise<Number>} Tổng số giờ làm việc
 */
const calculateTotalWorkingHours = async (employeeDid, startDate, completionDate, deadline) => {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const completion = new Date(completionDate);
    const deadlineTime = new Date(deadline);
    
    // Xác định ngày kết thúc: nếu hoàn thành sau deadline, chỉ tính đến deadline
    const endDate = completion > deadlineTime ? deadlineTime : completion;
    const endDateOnly = new Date(endDate);
    endDateOnly.setHours(0, 0, 0, 0);
    
    let totalHours = 0;
    const currentDate = new Date(start);
    
    // Duyệt qua từng ngày từ ngày bắt đầu đến ngày kết thúc
    while (currentDate <= endDateOnly) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Tìm bản ghi chấm công trong ngày
      const chamCong = await ChamCong.findOne({
        employee_did: employeeDid,
        ngay: {
          $gte: dayStart,
          $lt: dayEnd
        }
      });
      
      if (chamCong) {
        let dayHours = 0;
        
        // Nếu là ngày deadline và hoàn thành sau 20:00, chỉ tính đến 20:00
        const isDeadlineDay = currentDate.toDateString() === deadlineTime.toDateString();
        const completedAfterDeadline = completion > deadlineTime;
        
        if (isDeadlineDay && completedAfterDeadline) {
          // Chỉ tính giờ làm đến 20:00
          if (chamCong.gio_vao) {
            const [hoursIn, minutesIn] = chamCong.gio_vao.split(':').map(Number);
            const timeIn = hoursIn * 60 + minutesIn;
            const timeOut = CUTOFF_TIME * 60; // 20:00 = 1200 phút
            const totalMinutes = Math.max(0, timeOut - timeIn);
            dayHours = totalMinutes / 60;
          } else if (chamCong.tong_gio_lam) {
            // Nếu không có gio_vao, ước tính: giả sử làm từ 8:00 đến 20:00
            // Hoặc lấy tong_gio_lam nhưng giới hạn đến 20:00
            dayHours = Math.min(chamCong.tong_gio_lam, 12); // Tối đa 12 giờ (8:00-20:00)
          }
        } else {
          // Ngày bình thường, tính toàn bộ giờ làm
          if (chamCong.tong_gio_lam !== null && chamCong.tong_gio_lam !== undefined) {
            dayHours = chamCong.tong_gio_lam;
          } else if (chamCong.gio_vao && chamCong.gio_ra) {
            const [hoursIn, minutesIn] = chamCong.gio_vao.split(':').map(Number);
            const [hoursOut, minutesOut] = chamCong.gio_ra.split(':').map(Number);
            const timeIn = hoursIn * 60 + minutesIn;
            const timeOut = hoursOut * 60 + minutesOut;
            const totalMinutes = timeOut - timeIn;
            dayHours = totalMinutes / 60;
          }
        }
        
        totalHours += dayHours;
      }
      
      // Tăng ngày
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return totalHours;
  } catch (error) {
    console.error('[calculateTotalWorkingHours] Error:', error);
    // Fallback: sử dụng gio_thuc_te từ task nếu có
    return 0;
  }
};

/**
 * Tính toán và thanh toán KPI cho task nhiều ngày
 * 
 * Logic:
 * - Deadline: Lấy ngày trong trường ngay_ket_thuc_du_kien và đặt giờ là 20:00:00
 * - Nếu ngay_hoan_thanh_thuc_te <= Deadline → Đúng hạn (100% KPI)
 * - Nếu ngay_hoan_thanh_thuc_te > Deadline → Trễ hạn (50% KPI)
 * - Nếu chưa được admin duyệt: KPI = 0
 * - Thanh toán: Chỉ thanh toán MỘT LẦN duy nhất vào ngày công việc chuyển trạng thái "Hoàn thành"
 * 
 * @param {String} taskId - ID của task
 * @param {Object} options - Tùy chọn
 * @param {Boolean} options.autoPay - Tự động thanh toán (mặc định: true)
 * @returns {Object} Kết quả tính toán và thanh toán
 */
const calculateAndPayMultiDayTask = async (taskId, options = {}) => {
  const { autoPay = true } = options;

  try {
    // 1. Lấy thông tin công việc từ DB
    const task = await CongViecGiao.findOne({ task_id: taskId });
    if (!task) {
      throw new Error('Không tìm thấy công việc');
    }

    // 2. Kiểm tra task có phải là task nhiều ngày không
    if (!isMultiDayTask(task)) {
      throw new Error('Task này không phải là task nhiều ngày (≥ 2 ngày)');
    }

    // 3. Kiểm tra trạng thái duyệt
    // ❌ TRƯỜNG HỢP 3: KHÔNG ĐƯỢC DUYỆT
    const adminApproved = await isTaskApproved(task);
    if (!adminApproved) {
      console.log('❌ Task chưa được Admin duyệt. KPI = 0');
      return {
        success: false,
        message: 'Task chưa được admin duyệt',
        kpi_amount: 0,
        final_percent: 0,
        admin_approved: false
      };
    }

    // 4. Lấy thông tin nhân viên để trả tiền
    const employee = await HoSoNhanVien.findOne({ employee_did: task.nguoi_thuc_hien_did });
    if (!employee || !employee.walletAddress) {
      throw new Error('Không tìm thấy ví nhân viên');
    }

    // 5. TÍNH TOÁN THỜI GIAN (Sử dụng ngay_ket_thuc_du_kien từ DB)
    // Mốc Deadline: Lấy ngày trong trường ngay_ket_thuc_du_kien và đặt giờ là 20:00:00
    const targetDate = task.ngay_ket_thuc_du_kien 
      ? new Date(task.ngay_ket_thuc_du_kien) 
      : new Date(task.ngay_bat_dau);
    
    const deadline = new Date(targetDate);
    deadline.setHours(CUTOFF_TIME, 0, 0, 0); // 20:00:00
    
    const finishTime = new Date(task.ngay_hoan_thanh_thuc_te);

    console.log(`🔹 Task: ${task.ten_cong_viec}`);
    console.log(`   Deadline: ${deadline.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    console.log(`   Hoàn thành: ${finishTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

    // 6. XÉT CÁC TRƯỜNG HỢP KPI
    // So sánh: Nếu ngay_hoan_thanh_thuc_te <= Mốc Deadline → Đúng hạn (100% KPI)
    //          Nếu ngay_hoan_thanh_thuc_te > Mốc Deadline → Trễ hạn (50% KPI)
    let finalPercent = task.tien_do || 100; // Mặc định lấy tiến độ gốc (VD: 100)
    let isOnTime = false;

    if (finishTime <= deadline) {
      // ✅ TRƯỜNG HỢP 1: HOÀN THÀNH ĐÚNG HẠN (<= Deadline)
      console.log(`✅ Đánh giá: Đúng hạn (Giữ nguyên tiến độ)`);
      isOnTime = true;
      // finalPercent giữ nguyên
    } else {
      // ⚠️ TRƯỜNG HỢP 2: HOÀN THÀNH TRỄ HẠN (> Deadline)
      console.log(`⚠️ Đánh giá: Trễ hạn (Giảm 50% tiến độ)`);
      finalPercent = finalPercent * 0.5;
      isOnTime = false;
    }

    // 7. TÍNH TỔNG GIỜ LÀM VIỆC THỰC TẾ
    // Tính từ ngay_bat_dau đến ngay_hoan_thanh_thuc_te
    // Nếu hoàn thành sau deadline, chỉ tính đến 20:00 của ngày deadline
    const totalHours = await calculateTotalWorkingHours(
      task.nguoi_thuc_hien_did,
      task.ngay_bat_dau,
      task.ngay_hoan_thanh_thuc_te,
      deadline
    );

    // Fallback: nếu không tính được từ chấm công, sử dụng gio_thuc_te từ task
    const actualTotalHours = totalHours > 0 ? totalHours : (task.gio_thuc_te || 0);

    // 8. TÍNH TIỀN THƯỞNG
    // Công thức: (Tiến độ% / 100) × Tổng giờ làm thực tế × 2 USDT
    const rewardAmount = (finalPercent / 100) * actualTotalHours * REWARD_RATE;

    console.log(`💰 Tổng giờ làm: ${actualTotalHours}h | Tiến độ thực tế: ${finalPercent}% | Thưởng: ${rewardAmount.toFixed(2)} TUSD`);

    if (rewardAmount <= 0) {
      return {
        success: true,
        message: 'KPI = 0, không cần chuyển tiền',
        kpi_amount: 0,
        final_percent: finalPercent,
        total_hours: actualTotalHours,
        admin_approved: true
      };
    }

    // 9. GỌI SMART CONTRACT (Thanh toán)
    let paymentResult = null;
    if (autoPay) {
      try {
        console.log('🚀 Đang gửi lệnh thanh toán...');
        
        paymentResult = await payTaskReward(
          employee.employee_did,
          rewardAmount,
          task.task_id
        );

        console.log(`🎉 Giao dịch thành công: ${paymentResult.transactionHash}`);

        // Update task with transaction hash if payment successful
        if (paymentResult && paymentResult.success) {
          await CongViecGiao.findOneAndUpdate(
            { task_id: taskId },
            {
              $set: {
                'payment_transaction_hash': paymentResult.transactionHash,
                'payment_block_number': paymentResult.blockNumber,
                'payment_timestamp': new Date(),
                'payment_status': 'completed'
              }
            }
          );
        }
      } catch (paymentError) {
        console.error('❌ Lỗi thanh toán:', paymentError);
        paymentResult = {
          success: false,
          error: paymentError.message || 'Payment failed'
        };
      }
    }

    return {
      success: true,
      message: 'Đã tính KPI và thanh toán thành công',
      task_id: taskId,
      employee_did: employee.employee_did,
      employee_name: employee.ho_ten || employee.ten_nhan_vien || employee.employee_did,
      tien_do_goc: task.tien_do || 100,
      final_percent: finalPercent,
      total_hours: actualTotalHours,
      deadline: deadline.toISOString(),
      finish_time: finishTime.toISOString(),
      completed_before_deadline: isOnTime,
      admin_approved: true,
      kpi_amount: parseFloat(rewardAmount.toFixed(2)),
      payment_result: paymentResult,
      calculated_at: new Date()
    };
  } catch (error) {
    console.error('❌ Lỗi xử lý:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      kpi_amount: 0
    };
  }
};

/**
 * Lấy danh sách task nhiều ngày (từ 2 ngày trở lên)
 * @param {Object} filters - Bộ lọc
 * @returns {Array} Danh sách task nhiều ngày
 */
const getMultiDayTasks = async (filters = {}) => {
  try {
    const {
      employee_did,
      trang_thai,
      start_date,
      end_date
    } = filters;

    // Build query
    const query = {};

    // Filter by employee
    if (employee_did) {
      query.nguoi_thuc_hien_did = employee_did;
    }

    // Filter by status
    if (trang_thai) {
      query.trang_thai = trang_thai;
    }

    // Filter by date range
    if (start_date || end_date) {
      query.ngay_bat_dau = {};
      if (start_date) {
        query.ngay_bat_dau.$gte = new Date(start_date);
      }
      if (end_date) {
        query.ngay_bat_dau.$lte = new Date(end_date);
      }
    }

    // Get all tasks matching filters
    const tasks = await CongViecGiao.find(query).sort({ ngay_bat_dau: -1 });

    // Filter to only multi-day tasks
    const multiDayTasks = tasks.filter(task => isMultiDayTask(task));

    // Enrich with additional info
    const enrichedTasks = await Promise.all(
      multiDayTasks.map(async (task) => {
        const startDate = new Date(task.ngay_bat_dau);
        const endDate = new Date(task.ngay_ket_thuc_du_kien);
        const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        // Deadline: Lấy ngày trong trường ngay_ket_thuc_du_kien và đặt giờ là 20:00:00
        // Nếu không có ngay_ket_thuc_du_kien thì fallback về ngay_bat_dau (phòng hờ lỗi data)
        const targetDate = task.ngay_ket_thuc_du_kien 
          ? new Date(task.ngay_ket_thuc_du_kien) 
          : new Date(task.ngay_bat_dau);
        
        const deadline = new Date(targetDate);
        deadline.setHours(CUTOFF_TIME, 0, 0, 0); // 20:00:00

        // Get employee info
        const employee = await HoSoNhanVien.findOne({ employee_did: task.nguoi_thuc_hien_did });

        return {
          ...task.toObject(),
          days_duration: daysDiff + 1, // +1 vì tính cả ngày đầu
          deadline: deadline.toISOString(),
          deadline_timestamp: deadline,
          employee_name: employee?.ho_ten || employee?.ten_nhan_vien || task.nguoi_thuc_hien_did,
          is_completed_before_deadline: task.ngay_hoan_thanh_thuc_te
            ? new Date(task.ngay_hoan_thanh_thuc_te) <= deadline
            : null
        };
      })
    );

    return enrichedTasks;
  } catch (error) {
    console.error('[getMultiDayTasks] Error:', error);
    throw error;
  }
};

/**
 * Tính tỷ lệ hoàn thành trung bình cho nhiều công việc trong kỳ
 * @param {String} employeeDid - ID nhân viên
 * @param {Date} startDate - Ngày bắt đầu kỳ
 * @param {Date} endDate - Ngày kết thúc kỳ
 * @returns {Promise<Object>} Kết quả tính toán
 */
const calculateAverageCompletionRateForPeriod = async (employeeDid, startDate, endDate) => {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Lấy tất cả công việc nhiều ngày trong kỳ
    const tasks = await CongViecGiao.find({
      nguoi_thuc_hien_did: employeeDid,
      ngay_bat_dau: { $gte: start, $lte: end },
      trang_thai: 'Hoàn thành'
    });

    // Lọc chỉ lấy công việc nhiều ngày
    const multiDayTasks = tasks.filter(task => isMultiDayTask(task));

    if (multiDayTasks.length === 0) {
      return {
        total_tasks: 0,
        approved_tasks: 0,
        average_completion_rate: 0,
        total_hours: 0,
        average_hours: 0,
        total_kpi: 0
      };
    }

    // Tính tiến độ thực tế cho từng công việc
    const taskResults = [];
    let totalApprovedTasks = 0;
    let sumCompletionRate = 0;
    let totalHours = 0;

    for (const task of multiDayTasks) {
      const approved = await isTaskApproved(task);
      if (!approved) {
        continue; // Bỏ qua công việc chưa được duyệt
      }

      totalApprovedTasks++;

      // Tính deadline
      const targetDate = task.ngay_ket_thuc_du_kien 
        ? new Date(task.ngay_ket_thuc_du_kien) 
        : new Date(task.ngay_bat_dau);
      const deadline = new Date(targetDate);
      deadline.setHours(CUTOFF_TIME, 0, 0, 0);

      const finishTime = new Date(task.ngay_hoan_thanh_thuc_te);
      let completionRate = task.tien_do || 100;

      // Nếu trễ hạn, giảm 50%
      if (finishTime > deadline) {
        completionRate = completionRate * 0.5;
      }

      // Tính tổng giờ làm
      const hours = await calculateTotalWorkingHours(
        employeeDid,
        task.ngay_bat_dau,
        task.ngay_hoan_thanh_thuc_te,
        deadline
      );
      const actualHours = hours > 0 ? hours : (task.gio_thuc_te || 0);

      sumCompletionRate += completionRate;
      totalHours += actualHours;

      taskResults.push({
        task_id: task.task_id,
        ten_cong_viec: task.ten_cong_viec,
        tien_do_goc: task.tien_do || 100,
        tien_do_thuc_te: completionRate,
        total_hours: actualHours,
        completed_before_deadline: finishTime <= deadline
      });
    }

    // Tính trung bình
    const averageCompletionRate = totalApprovedTasks > 0 
      ? sumCompletionRate / totalApprovedTasks 
      : 0;
    const averageHours = totalApprovedTasks > 0 
      ? totalHours / totalApprovedTasks 
      : 0;

    // Tính KPI tổng
    const totalKpi = (averageCompletionRate / 100) * averageHours * REWARD_RATE;

    return {
      total_tasks: multiDayTasks.length,
      approved_tasks: totalApprovedTasks,
      average_completion_rate: parseFloat(averageCompletionRate.toFixed(2)),
      total_hours: parseFloat(totalHours.toFixed(2)),
      average_hours: parseFloat(averageHours.toFixed(2)),
      total_kpi: parseFloat(totalKpi.toFixed(2)),
      task_details: taskResults
    };
  } catch (error) {
    console.error('[calculateAverageCompletionRateForPeriod] Error:', error);
    throw error;
  }
};

module.exports = {
  isSingleDayTask,
  isMultiDayTask,
  isTaskApproved,
  calculateAndPayMultiDayTask,
  getMultiDayTasks,
  calculateAverageCompletionRateForPeriod,
  calculateTotalWorkingHours
};

