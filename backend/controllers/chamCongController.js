const ChamCong = require('../models/ChamCong');
const SmartContractLogs = require('../models/SmartContractLogs');
const AuditLogs = require('../models/AuditLogs');
const crypto = require('crypto');
const Web3 = require('web3');

const CHECKIN_TIME_LOCK_ENABLED = process.env.CHECKIN_TIME_LOCK_ENABLED !== 'false';
const CHECKOUT_TIME_LOCK_ENABLED = process.env.CHECKOUT_TIME_LOCK_ENABLED !== 'false';
const CHECKIN_START_MINUTES = Number(process.env.CHECKIN_START_MINUTES || 6 * 60);
// Cho phép check-in đến 17:30 (5 giờ 30 chiều)
const CHECKIN_END_MINUTES = Number(
  process.env.CHECKIN_END_MINUTES || (17 * 60 + 30)
);
// Khóa chức năng chấm công sau 17:30 (không cho tăng ca sau thời điểm này)
const CHECKOUT_LOCK_MINUTES = Number(
  process.env.CHECKOUT_LOCK_MINUTES || (17 * 60 + 30)
);
// Đặt mốc tăng ca trùng với thời điểm khóa để đảm bảo không có giờ tăng ca
const OVERTIME_START_MINUTES = Number(
  process.env.OVERTIME_START_MINUTES || (17 * 60 + 30)
);
// Số giờ tối đa được tính lương trong một ngày (mặc định: 11.5 giờ = 6:00 đến 17:30)
const MAX_PAID_HOURS = Number(process.env.MAX_PAID_HOURS || 11.5);
const REGULAR_HOURLY_RATE = Number(process.env.REGULAR_HOURLY_RATE || 2);
const OVERTIME_HOURLY_RATE = Number(process.env.OVERTIME_HOURLY_RATE || 4);

const minutesToTimeString = (minutes) => {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}:00`;
};

const minutesToDisplayString = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const minuteStr = mins.toString().padStart(2, '0');
  return `${displayHours}:${minuteStr} ${suffix}`;
};

// Giới hạn số giờ được tính lương trong ngày
const clampPaidHours = (hours) => {
  if (hours <= 0) return 0;
  return Math.min(hours, MAX_PAID_HOURS);
};

// Get all attendance records with optional filters
const getAll = async (req, res) => {
  try {
    const { startDate, endDate, departmentId, status } = req.query;
    let query = {};

    // Apply date range filter
    if (startDate && endDate) {
      query.ngay = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Apply status filter
    if (status && status !== 'all') {
      query.trang_thai_cham_cong = status;
    }

    // If filtering by department, first get employees in that department
    if (departmentId && departmentId !== 'all') {
      const HoSoNhanVien = require('../models/HoSoNhanVien');
      const employeesInDept = await HoSoNhanVien.find({ phong_ban_id: departmentId }, { employee_did: 1 });
      const employeeDids = employeesInDept.map(emp => emp.employee_did);
      query.employee_did = { $in: employeeDids };
    }

    const chamCong = await ChamCong.find(query).sort({ ngay: -1 });

    // Auto-update status for records without checkout (Tạm ngưng)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const record of chamCong) {
      const recordDate = new Date(record.ngay);
      recordDate.setHours(0, 0, 0, 0);
      
      // If record has check-in but no check-out, and it's not today, set status to "Tạm ngưng"
      if (record.gio_vao && !record.gio_ra && recordDate.getTime() < today.getTime()) {
        if (record.trang_thai_cham_cong !== 'Tạm ngưng') {
          record.trang_thai_cham_cong = 'Tạm ngưng';
          await record.save();
        }
      }
      // If record has both check-in and check-out, set status to "Đã hoàn thành"
      else if (record.gio_vao && record.gio_ra && record.trang_thai_cham_cong !== 'Đã hoàn thành') {
        record.trang_thai_cham_cong = 'Đã hoàn thành';
        await record.save();
      }
    }

    res.json(chamCong);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get attendance by employee DID
const getByEmployee = async (req, res) => {
  try {
    const { startDate, endDate, loai_ngay, xac_thuc_qua, onChain } = req.query;

    let query = { employee_did: req.params.employeeDid };

    // Apply date range filter
    if (startDate && endDate) {
      query.ngay = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Apply day type filter
    if (loai_ngay && loai_ngay !== 'all') {
      query.loai_ngay = loai_ngay;
    }

    // Apply authentication method filter
    if (xac_thuc_qua && xac_thuc_qua !== 'all') {
      query.xac_thuc_qua = xac_thuc_qua;
    }

    // Apply on-chain filter
    if (onChain !== undefined && onChain !== 'all') {
      const isOnChain = onChain === 'true' || onChain === true;
      if (isOnChain) {
        query.transaction_hash = { $exists: true, $ne: null };
      } else {
        query.$or = [
          { transaction_hash: { $exists: false } },
          { transaction_hash: null }
        ];
      }
    }

    const chamCong = await ChamCong.find(query)
      .sort({ ngay: -1 }); // Sort by date descending

    // Auto-update status for records without checkout (Tạm ngưng)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const MIN_REQUIRED_HOURS = 5;
    
    for (const record of chamCong) {
      const recordDate = new Date(record.ngay);
      recordDate.setHours(0, 0, 0, 0);
      let needsSave = false;
      
      // If record has check-in but no check-out, and it's not today, set status to "Tạm ngưng"
      if (record.gio_vao && !record.gio_ra && recordDate.getTime() < today.getTime()) {
        if (record.trang_thai_cham_cong !== 'Tạm ngưng') {
          record.trang_thai_cham_cong = 'Tạm ngưng';
          needsSave = true;
        }
      }
      // If record has both check-in and check-out, set status to "Đã hoàn thành"
      else if (record.gio_vao && record.gio_ra && record.trang_thai_cham_cong !== 'Đã hoàn thành') {
        record.trang_thai_cham_cong = 'Đã hoàn thành';
        needsSave = true;
      }
      
      // Auto-calculate salary if missing but has tong_gio_lam
      // Special handling for missed checkout approved: always recalculate if salary is 0 or missing
      const isMissedCheckoutApproved = record.quen_checkout_trang_thai === 'Đã phê duyệt';
      const shouldCalculateSalary = record.tong_gio_lam && record.tong_gio_lam > 0 && 
          (record.luong_tinh_theo_gio === null || 
           record.luong_tinh_theo_gio === undefined || 
           record.luong_tinh_theo_gio === 0 ||
           (isMissedCheckoutApproved && record.luong_tinh_theo_gio === 0)); // Recalculate if missed checkout approved but salary is 0
      
      if (shouldCalculateSalary) {
        const multiplier = isMissedCheckoutApproved ? 0.5 : 1;
        
        // For missed checkout approved: always calculate salary with 50% penalty (ignore minimum hours)
        // For normal records: check minimum 5 hours requirement
        if (isMissedCheckoutApproved || record.tong_gio_lam >= MIN_REQUIRED_HOURS) {
          const calculatedSalary = record.tong_gio_lam * REGULAR_HOURLY_RATE * multiplier;
          const newSalary = Number(calculatedSalary.toFixed(2));
          
          // Only update if salary is different (to avoid unnecessary saves)
          if (record.luong_tinh_theo_gio !== newSalary) {
            record.luong_tinh_theo_gio = newSalary;
            needsSave = true;
            console.log(`[getByEmployee] Auto-calculated salary for ${record.employee_did} on ${record.ngay}: ${record.luong_tinh_theo_gio} USDT (hours: ${record.tong_gio_lam}, multiplier: ${multiplier}, missed checkout: ${isMissedCheckoutApproved})`);
          }
        } else {
          // Below minimum hours for normal records, set salary to 0
          if (record.luong_tinh_theo_gio !== 0) {
            record.luong_tinh_theo_gio = 0;
            needsSave = true;
          }
        }
      }
      
      if (needsSave) {
        await record.save();
      }
    }

    res.json(chamCong);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get attendance by ID (MongoDB _id)
const getById = async (req, res) => {
  try {
    const chamCong = await ChamCong.findById(req.params.id);
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    res.json(chamCong);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get attendance by date range
const getByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const chamCong = await ChamCong.find({
      ngay: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });
    res.json(chamCong);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get attendance by employee and date
const getByEmployeeAndDate = async (req, res) => {
  try {
    const chamCong = await ChamCong.findOne({
      employee_did: req.params.employeeDid,
      ngay: req.params.date
    });
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    res.json(chamCong);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new attendance record
const create = async (req, res) => {
  const chamCong = new ChamCong(req.body);
  try {
    const newChamCong = await chamCong.save();
    res.status(201).json(newChamCong);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update attendance record
const update = async (req, res) => {
  try {
    const updatedChamCong = await ChamCong.findOneAndUpdate(
      {
        employee_did: req.params.employeeDid,
        ngay: req.params.date
      },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedChamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    res.json(updatedChamCong);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete attendance record
const deleteAttendance = async (req, res) => {
  try {
    const deletedChamCong = await ChamCong.findOneAndDelete({
      employee_did: req.params.employeeDid,
      ngay: req.params.date
    });
    if (!deletedChamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate record hash
const calculateRecordHash = (record) => {
  const data = {
    employee_did: record.employee_did,
    ngay: record.ngay.toISOString().split('T')[0],
    gio_vao: record.gio_vao,
    gio_ra: record.gio_ra,
    tong_gio_lam: record.tong_gio_lam,
    xac_thuc_qua: record.xac_thuc_qua
  };
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

// Helper function to anchor record on blockchain (mock implementation)
const anchorToBlockchain = async (employeeDid, date, recordHash) => {
  try {
    // Mock blockchain interaction - in real implementation, this would call smart contract
    const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    // Save to smart contract logs
    const smartContractLog = new SmartContractLogs({
      contract_address: process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
      transaction_hash: mockTxHash,
      block_number: Math.floor(Math.random() * 1000000) + 1000000,
      function_name: 'anchorAttendance',
      parameters: {
        employeeDid,
        date: new Date(date).toISOString().split('T')[0],
        recordHash
      },
      gas_used: Math.floor(Math.random() * 50000) + 20000,
      status: 'Success',
      event_logs: [{
        event_name: 'AttendanceAnchored',
        data: {
          employeeDid,
          date: new Date(date).toISOString().split('T')[0],
          recordHash
        }
      }],
      timestamp: new Date()
    });

    await smartContractLog.save();
    return mockTxHash;
  } catch (error) {
    console.error('Blockchain anchoring error:', error);
    throw error;
  }
};

// Helper function to determine day type
const determineDayType = (date) => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Check if it's weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'Cuối tuần';
  }

  // TODO: Add holiday checking logic here
  // For now, return 'Ngày thường' for weekdays
  return 'Ngày thường';
};

// Helper function to validate check-in time (6:00 AM - 5:00 PM / 17:00)
const isValidCheckInTime = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= CHECKIN_START_MINUTES && totalMinutes <= CHECKIN_END_MINUTES;
};

// Helper function to validate check-out time (before 7:00 PM / 19:00)
const isValidCheckOutTime = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes < CHECKOUT_LOCK_MINUTES;
};

// Helper function to check if time is overtime (after 5:00 PM / 17:00)
const isOvertime = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const overtimeStart = 17 * 60; // 5:00 PM (17:00)
  return totalMinutes >= overtimeStart;
};

// Check-in (create or update check-in time)
const checkIn = async (req, res) => {
  try {
    const { employee_did, ngay, gio_vao, xac_thuc_qua, qr_code_id } = req.body;

    // Validate required fields
    if (!employee_did || !ngay || !gio_vao || !xac_thuc_qua) {
      return res.status(400).json({ message: 'Missing required fields: employee_did, ngay, gio_vao, xac_thuc_qua' });
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (!timeRegex.test(gio_vao)) {
      return res.status(400).json({ message: 'Invalid time format for gio_vao. Use HH:MM:SS' });
    }

    // Validate check-in time is between 6:00 AM and 5:00 PM (17:00)
    if (CHECKIN_TIME_LOCK_ENABLED && !isValidCheckInTime(gio_vao)) {
      return res.status(400).json({
        message: `Check-in chỉ được phép từ ${minutesToDisplayString(CHECKIN_START_MINUTES)} đến ${minutesToDisplayString(CHECKIN_END_MINUTES)}.`
      });
    }

    // Convert date string to Date object
    const attendanceDate = new Date(ngay);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for ngay. Use YYYY-MM-DD' });
    }

    // Validate that check-in is only allowed for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(attendanceDate);
    checkInDate.setHours(0, 0, 0, 0);
    
    if (checkInDate.getTime() !== today.getTime()) {
      return res.status(400).json({ 
        message: 'Chỉ có thể check-in cho ngày hôm nay. Hệ thống đã tự động reset trạng thái sau 24 giờ.' 
      });
    }

    // Validate QR code if provided
    if (xac_thuc_qua === 'QR Code' && qr_code_id) {
      const QrAuthentication = require('../models/QrAuthentication');
      const qrAuth = await QrAuthentication.findOne({
        qr_code_id: qr_code_id,
        employee_did: employee_did,
        trang_thai: 'Hoạt động'
      });

      if (!qrAuth) {
        return res.status(400).json({ message: 'Invalid or inactive QR code' });
      }

      // Update QR usage
      qrAuth.so_lan_su_dung += 1;
      qrAuth.lan_su_dung_cuoi = new Date();
      await qrAuth.save();
    }

    // Check if employee already checked in today
    const existingRecord = await ChamCong.findOne({ employee_did, ngay: attendanceDate });
    if (existingRecord && existingRecord.gio_vao) {
      return res.status(400).json({ message: 'Employee has already checked in today' });
    }

    const dayType = determineDayType(attendanceDate);

    let chamCong;
    if (existingRecord) {
      // Update existing record
      existingRecord.gio_vao = gio_vao;
      existingRecord.xac_thuc_qua = xac_thuc_qua;
      existingRecord.loai_ngay = dayType;
      chamCong = await existingRecord.save();
    } else {
      // Create new record
      chamCong = new ChamCong({
        employee_did,
        ngay: attendanceDate,
        gio_vao,
        xac_thuc_qua,
        loai_ngay: dayType,
        trang_thai_cham_cong: 'Tạm ngưng' // Set status to "Tạm ngưng" when checked in but not checked out
      });
      chamCong = await chamCong.save();
    }

    // Calculate record hash and anchor to blockchain
    const recordHash = calculateRecordHash(chamCong);
    chamCong.record_hash = recordHash;

    try {
      const txHash = await anchorToBlockchain(employee_did, ngay, recordHash);
      chamCong.transaction_hash = txHash;
    } catch (blockchainError) {
      console.error('Blockchain anchoring failed:', blockchainError);
      // Continue without blockchain anchoring
    }

    await chamCong.save();

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: employee_did,
      action: existingRecord ? 'UPDATE' : 'CREATE',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        before: existingRecord || null,
        after: {
          employee_did,
          ngay,
          gio_vao,
          xac_thuc_qua,
          loai_ngay: dayType,
          record_hash: recordHash,
          transaction_hash: chamCong.transaction_hash
        }
      },
      status: 'Success',
      details: `Check-in recorded for ${employee_did} on ${ngay} at ${gio_vao}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    res.json(chamCong);
  } catch (error) {
    console.error('Check-in error:', error);

    // Create error audit log
    try {
      const auditLog = new AuditLogs({
        user_did: req.body.employee_did || 'unknown',
        action: 'CREATE',
        resource_type: 'cham_cong',
        resource_id: null,
        changes: { error: error.message },
        status: 'Failed',
        details: `Check-in failed: ${error.message}`,
        timestamp: new Date(),
        ip_address: req.ip
      });
      await auditLog.save();
    } catch (auditError) {
      console.error('Failed to create error audit log:', auditError);
    }

    res.status(400).json({ message: error.message });
  }
};

// Check-out (update check-out time and calculate total hours)
const checkOut = async (req, res) => {
  try {
    const { employee_did, ngay, gio_ra, qr_code_id } = req.body;

    // Validate required fields
    if (!employee_did || !ngay || !gio_ra) {
      return res.status(400).json({ message: 'Missing required fields: employee_did, ngay, gio_ra' });
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (!timeRegex.test(gio_ra)) {
      return res.status(400).json({ message: 'Invalid time format for gio_ra. Use HH:MM:SS' });
    }

    // Convert date string to Date object for consistent querying
    const attendanceDate = new Date(ngay);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for ngay. Use YYYY-MM-DD' });
    }

    // Validate that check-out is only allowed for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(attendanceDate);
    checkOutDate.setHours(0, 0, 0, 0);
    
    if (checkOutDate.getTime() !== today.getTime()) {
      return res.status(400).json({ 
        message: 'Chỉ có thể check-out cho ngày hôm nay. Hệ thống đã tự động reset trạng thái sau 24 giờ.' 
      });
    }

    const chamCong = await ChamCong.findOne({ employee_did, ngay: attendanceDate });

    if (!chamCong) {
      return res.status(404).json({ message: 'Check-in record not found for today' });
    }

    // Check if already checked out
    if (chamCong.gio_ra) {
      return res.status(400).json({ message: 'Employee has already checked out today' });
    }

    // Check if check-in exists
    if (!chamCong.gio_vao) {
      return res.status(400).json({ message: 'Cannot check-out without check-in first' });
    }

    // Validate check-out time is after check-in time
    const checkInTime = new Date(`${ngay}T${chamCong.gio_vao}`);
    const checkOutTime = new Date(`${ngay}T${gio_ra}`);

    if (checkOutTime <= checkInTime) {
      return res.status(400).json({ message: 'Check-out time must be after check-in time' });
    }

    // Validate check-out time if lock is enabled
    if (CHECKOUT_TIME_LOCK_ENABLED && !isValidCheckOutTime(gio_ra)) {
      return res.status(400).json({
        message: `Check-out chỉ được phép trước ${minutesToDisplayString(CHECKOUT_LOCK_MINUTES)}. Sau thời gian này chức năng chấm công sẽ bị khóa.`
      });
    }

    // Validate QR code if provided
    if (chamCong.xac_thuc_qua === 'QR Code' && qr_code_id) {
      const QrAuthentication = require('../models/QrAuthentication');
      const qrAuth = await QrAuthentication.findOne({
        qr_code_id: qr_code_id,
        employee_did: employee_did,
        trang_thai: 'Hoạt động'
      });

      if (!qrAuth) {
        return res.status(400).json({ message: 'Invalid or inactive QR code' });
      }

      // Update QR usage
      qrAuth.so_lan_su_dung += 1;
      qrAuth.lan_su_dung_cuoi = new Date();
      await qrAuth.save();
    }

    chamCong.gio_ra = gio_ra;

    // Tính tổng giờ làm việc, giới hạn tối đa theo MAX_PAID_HOURS
    const rawTotalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    const totalHours = clampPaidHours(rawTotalHours);
    chamCong.tong_gio_lam = Math.round(totalHours * 100) / 100; // Round to 2 decimal places

    // Tính lương (nếu đang bật chế độ trả lương theo giờ)
    const overtimeStartTime = new Date(`${ngay}T${minutesToTimeString(OVERTIME_START_MINUTES)}`);
    const checkoutLimitTime = new Date(`${ngay}T${minutesToTimeString(CHECKOUT_LOCK_MINUTES)}`);
    const hourMs = 1000 * 60 * 60;

    // Cắt thời gian checkout ở mốc giới hạn (17:30) để không tính lương sau đó
    const effectiveCheckOutTime = new Date(
      Math.min(checkOutTime.getTime(), checkoutLimitTime.getTime())
    );

    const overtimeDurationMs = Math.max(
      0,
      Math.min(effectiveCheckOutTime, checkoutLimitTime) - Math.max(checkInTime, overtimeStartTime)
    );
    const overtimeHours = overtimeDurationMs > 0 ? overtimeDurationMs / hourMs : 0;
    const regularHours = Math.max(0, totalHours - overtimeHours);

    // Mặc định tính lương bình thường theo giờ & tăng ca (nếu có)
    let regularPay = regularHours * REGULAR_HOURLY_RATE;
    let overtimePay = overtimeHours * OVERTIME_HOURLY_RATE;
    let totalPay = regularPay + overtimePay;

    // Điều kiện tối thiểu: phải làm ít nhất 5 giờ trong ngày mới được tính lương
    const MIN_REQUIRED_HOURS = 5;
    const isEligibleForSalary = totalHours >= MIN_REQUIRED_HOURS;

    if (!isEligibleForSalary) {
      // Không đủ 5 giờ: không tính lương, reset các field lương về 0
      regularPay = 0;
      overtimePay = 0;
      totalPay = 0;
      chamCong.gio_lam_them = 0;
      chamCong.trang_thai_lam_them = 'Không áp dụng';
      chamCong.luong_tinh_theo_gio = 0;
    } else {
      // Đủ 5 giờ: tính lương như bình thường
      chamCong.gio_lam_them = Number(overtimeHours.toFixed(2));
      chamCong.trang_thai_lam_them = chamCong.gio_lam_them > 0 ? 'Đã phê duyệt' : 'Không áp dụng';
      chamCong.luong_tinh_theo_gio = Number(totalPay.toFixed(2));
    }
    chamCong.trang_thai_cham_cong = 'Đã hoàn thành'; // Update status to completed

    // Calculate record hash and anchor to blockchain
    const recordHash = calculateRecordHash(chamCong);
    chamCong.record_hash = recordHash;

    try {
      const txHash = await anchorToBlockchain(employee_did, ngay, recordHash);
      chamCong.transaction_hash = txHash;
    } catch (blockchainError) {
      console.error('Blockchain anchoring failed:', blockchainError);
      // Continue without blockchain anchoring
    }

    await chamCong.save();

    // Automatically pay salary via smart contract when checkout
    let paymentResult = null;
    try {
      const attendancePaymentService = require('../services/attendancePaymentService');
      const dateString = ngay.split('T')[0]; // Ensure YYYY-MM-DD format

      if (!isEligibleForSalary) {
        // Không đủ 5 giờ: không gọi smart contract, chỉ trả thông báo cho frontend
        paymentResult = {
          success: false,
          eligible: false,
          hoursWorked: chamCong.tong_gio_lam,
          usdtAmount: 0,
          message: `Số giờ làm (${chamCong.tong_gio_lam.toFixed(2)}h) chưa đạt yêu cầu tối thiểu ${MIN_REQUIRED_HOURS} giờ, hệ thống sẽ không thanh toán lương cho ngày này.`
        };
        console.warn(
          `[checkOut] Attendance hours below minimum requirement. No payment processed for ${employee_did} on ${dateString}.`
        );
      } else {
        paymentResult = await attendancePaymentService.payAttendanceSalary(
          employee_did,
          dateString,
          chamCong.tong_gio_lam,
          { customAmountUsdt: chamCong.luong_tinh_theo_gio }
        );
        
        if (paymentResult.success) {
          chamCong.salary_transaction_hash = paymentResult.transactionHash;
          await chamCong.save();
          console.log(
            `[checkOut] Automatic payment successful for ${employee_did} on ${dateString}: ${paymentResult.usdtAmount} USDT`
          );
        } else {
          console.warn(`[checkOut] Payment not eligible: ${paymentResult.message}`);
        }
      }
    } catch (paymentError) {
      console.error('[checkOut] Automatic payment failed:', paymentError);
      paymentResult = {
        success: false,
        message: paymentError.message || 'Automatic payment failed',
        error: paymentError.stack
      };
      // Continue without payment - don't fail the checkout
      // Payment can be retried later
    }

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: employee_did,
      action: 'UPDATE',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        before: {
          gio_ra: null,
          tong_gio_lam: null
        },
        after: {
          gio_ra,
          tong_gio_lam: chamCong.tong_gio_lam,
          record_hash: recordHash,
          transaction_hash: chamCong.transaction_hash
        }
      },
      status: 'Success',
      details: `Check-out recorded for ${employee_did} on ${ngay} at ${gio_ra}. Total hours: ${chamCong.tong_gio_lam}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    // Include payment information in response
    const responseData = {
      ...chamCong.toObject(),
      payment: paymentResult ? {
        success: paymentResult.success,
        transactionHash: paymentResult.transactionHash,
        usdtAmount: paymentResult.usdtAmount,
        message: paymentResult.message || (paymentResult.success ? 'Payment successful' : 'Payment not eligible'),
        eligible: paymentResult.eligible !== undefined ? paymentResult.eligible : paymentResult.success
      } : null,
      salaryDetails: {
        regularHours: Number(regularHours.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        regularRate: REGULAR_HOURLY_RATE,
        overtimeRate: OVERTIME_HOURLY_RATE,
        regularPay: Number(regularPay.toFixed(2)),
        overtimePay: Number(overtimePay.toFixed(2)),
        totalPay: Number(totalPay.toFixed(2)),
        isEligibleForSalary: isEligibleForSalary,
        minimumRequiredHours: MIN_REQUIRED_HOURS,
        totalHours: Number(totalHours.toFixed(2))
      },
      warning: !isEligibleForSalary ? {
        message: `Bạn đã làm việc ${totalHours.toFixed(2)} giờ, chưa đạt yêu cầu tối thiểu ${MIN_REQUIRED_HOURS} giờ/ngày.`,
        reason: `Theo quy định, nhân viên phải làm việc tối thiểu ${MIN_REQUIRED_HOURS} giờ trong một ngày để được tính lương. Số giờ làm việc của bạn (${totalHours.toFixed(2)}h) chưa đủ điều kiện, nên lương ngày hôm nay sẽ không được thanh toán.`,
        totalHours: Number(totalHours.toFixed(2)),
        requiredHours: MIN_REQUIRED_HOURS
      } : null
    };

    res.json(responseData);
  } catch (error) {
    console.error('Check-out error:', error);

    // Create error audit log
    try {
      const auditLog = new AuditLogs({
        user_did: req.body.employee_did || 'unknown',
        action: 'UPDATE',
        resource_type: 'cham_cong',
        resource_id: null,
        changes: { error: error.message },
        status: 'Failed',
        details: `Check-out failed: ${error.message}`,
        timestamp: new Date(),
        ip_address: req.ip
      });
      await auditLog.save();
    } catch (auditError) {
      console.error('Failed to create error audit log:', auditError);
    }

    res.status(400).json({ message: error.message });
  }
};

// Admin functions for manual attendance management
const createManualAttendance = async (req, res) => {
  try {
    const {
      employee_did,
      ngay,
      gio_vao,
      gio_ra,
      loai_ngay,
      ghi_chu,
      xac_thuc_qua = 'Manual',
      gio_lam_them = 0,
      loai_nghi_phep,
      so_ngay_nghi = 0,
      ly_do_nghi,
      ghi_chu_admin
    } = req.body;

    // Validate required fields
    if (!employee_did || !ngay) {
      return res.status(400).json({ message: 'Missing required fields: employee_did, ngay' });
    }

    // Convert date string to Date object
    const attendanceDate = new Date(ngay);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for ngay. Use YYYY-MM-DD' });
    }

    // Check if record already exists
    const existingRecord = await ChamCong.findOne({ employee_did, ngay: attendanceDate });
    if (existingRecord) {
      return res.status(400).json({ message: 'Attendance record already exists for this employee on this date' });
    }

    // Calculate total hours if both check-in and check-out are provided
    let tong_gio_lam = null;
    if (gio_vao && gio_ra) {
      const checkInTime = new Date(`${ngay}T${gio_vao}`);
      const checkOutTime = new Date(`${ngay}T${gio_ra}`);
      if (checkOutTime > checkInTime) {
        let totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        totalHours = clampPaidHours(totalHours);
        tong_gio_lam = Math.round(totalHours * 100) / 100;
      }
    }

    // Determine approval status based on input
    let trang_thai_phe_duyet = 'Không cần phê duyệt';
    let trang_thai_lam_them = 'Không áp dụng';
    let trang_thai_nghi_phep = 'Không áp dụng';

    if (gio_lam_them > 0) {
      trang_thai_lam_them = 'Chờ phê duyệt';
    }

    if (loai_nghi_phep && so_ngay_nghi > 0) {
      trang_thai_nghi_phep = 'Chờ phê duyệt';
      trang_thai_phe_duyet = 'Chờ phê duyệt';
    }

    const chamCong = new ChamCong({
      employee_did,
      ngay: attendanceDate,
      gio_vao,
      gio_ra,
      tong_gio_lam,
      loai_ngay: loai_ngay || determineDayType(attendanceDate),
      ghi_chu,
      xac_thuc_qua,
      gio_lam_them,
      trang_thai_lam_them,
      loai_nghi_phep,
      so_ngay_nghi,
      trang_thai_nghi_phep,
      ly_do_nghi,
      trang_thai_phe_duyet,
      ghi_chu_admin,
      nhap_thu_cong: true,
      nguoi_nhap_did: req.user?.employee_did,
      ngay_nhap: new Date()
    });

    const newChamCong = await chamCong.save();

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: req.user?.employee_did || 'admin',
      action: 'CREATE',
      resource_type: 'cham_cong',
      resource_id: newChamCong._id.toString(),
      changes: {
        before: null,
        after: {
          employee_did,
          ngay,
          gio_vao,
          gio_ra,
          tong_gio_lam,
          loai_ngay: newChamCong.loai_ngay,
          ghi_chu,
          xac_thuc_qua,
          nhap_thu_cong: true
        }
      },
      status: 'Success',
      details: `Manual attendance record created for ${employee_did} on ${ngay}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    res.status(201).json(newChamCong);
  } catch (error) {
    console.error('Create manual attendance error:', error);
    res.status(400).json({ message: error.message });
  }
};

const updateManualAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const chamCong = await ChamCong.findById(id);
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Store original data for audit
    const originalData = {
      employee_did: chamCong.employee_did,
      ngay: chamCong.ngay,
      gio_vao: chamCong.gio_vao,
      gio_ra: chamCong.gio_ra,
      tong_gio_lam: chamCong.tong_gio_lam,
      loai_ngay: chamCong.loai_ngay,
      ghi_chu: chamCong.ghi_chu,
      xac_thuc_qua: chamCong.xac_thuc_qua,
      gio_lam_them: chamCong.gio_lam_them,
      loai_nghi_phep: chamCong.loai_nghi_phep,
      so_ngay_nghi: chamCong.so_ngay_nghi
    };

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        chamCong[key] = updateData[key];
      }
    });

    // Recalculate total hours if times changed
    if (updateData.gio_vao || updateData.gio_ra) {
      const ngay = chamCong.ngay.toISOString().split('T')[0];
      const gio_vao = updateData.gio_vao || chamCong.gio_vao;
      const gio_ra = updateData.gio_ra || chamCong.gio_ra;

      if (gio_vao && gio_ra) {
        const checkInTime = new Date(`${ngay}T${gio_vao}`);
        const checkOutTime = new Date(`${ngay}T${gio_ra}`);
        if (checkOutTime > checkInTime) {
          let totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
          totalHours = clampPaidHours(totalHours);
          chamCong.tong_gio_lam = Math.round(totalHours * 100) / 100;
        }
      }
    }

    // Update approval status if overtime or leave changed
    if (updateData.gio_lam_them > 0 && chamCong.trang_thai_lam_them === 'Không áp dụng') {
      chamCong.trang_thai_lam_them = 'Chờ phê duyệt';
    }

    if ((updateData.loai_nghi_phep || updateData.so_ngay_nghi > 0) && chamCong.trang_thai_nghi_phep === 'Không áp dụng') {
      chamCong.trang_thai_nghi_phep = 'Chờ phê duyệt';
      chamCong.trang_thai_phe_duyet = 'Chờ phê duyệt';
    }

    chamCong.nhap_thu_cong = true;
    chamCong.nguoi_nhap_did = req.user?.employee_did;
    chamCong.ngay_nhap = new Date();

    await chamCong.save();

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: req.user?.employee_did || 'admin',
      action: 'UPDATE',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        before: originalData,
        after: {
          employee_did: chamCong.employee_did,
          ngay: chamCong.ngay,
          gio_vao: chamCong.gio_vao,
          gio_ra: chamCong.gio_ra,
          tong_gio_lam: chamCong.tong_gio_lam,
          loai_ngay: chamCong.loai_ngay,
          ghi_chu: chamCong.ghi_chu,
          xac_thuc_qua: chamCong.xac_thuc_qua,
          nhap_thu_cong: true
        }
      },
      status: 'Success',
      details: `Manual attendance record updated for ${chamCong.employee_did} on ${chamCong.ngay.toISOString().split('T')[0]}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    res.json(chamCong);
  } catch (error) {
    console.error('Update manual attendance error:', error);
    res.status(400).json({ message: error.message });
  }
};

const approveAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, ly_do_phe_duyet, ghi_chu_admin } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject"' });
    }

    const chamCong = await ChamCong.findById(id);
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Không cho phép thay đổi nếu đã được phê duyệt hoặc từ chối trước đó
    if (chamCong.trang_thai_phe_duyet === 'Đã phê duyệt' || chamCong.trang_thai_phe_duyet === 'Từ chối') {
      return res.status(400).json({
        message: 'Bản ghi chấm công này đã được xử lý, không thể phê duyệt lại.'
      });
    }

    const newStatus = action === 'approve' ? 'Đã phê duyệt' : 'Từ chối';

    chamCong.trang_thai_phe_duyet = newStatus;
    chamCong.nguoi_phe_duyet_did = req.user?.employee_did;
    chamCong.ngay_phe_duyet = new Date();
    chamCong.ly_do_phe_duyet = ly_do_phe_duyet;
    chamCong.ghi_chu_admin = ghi_chu_admin;

    await chamCong.save();

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: req.user?.employee_did || 'admin',
      action: 'APPROVE',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        before: { trang_thai_phe_duyet: chamCong.trang_thai_phe_duyet },
        after: { trang_thai_phe_duyet: newStatus }
      },
      status: 'Success',
      details: `Attendance record ${action}d for ${chamCong.employee_did} on ${chamCong.ngay.toISOString().split('T')[0]}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    res.json(chamCong);
  } catch (error) {
    console.error('Approve attendance error:', error);
    res.status(400).json({ message: error.message });
  }
};

const approveOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, ly_do_lam_them } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject"' });
    }

    const chamCong = await ChamCong.findById(id);
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Không cho phép thay đổi nếu tăng ca đã được phê duyệt hoặc từ chối trước đó
    if (chamCong.trang_thai_lam_them === 'Đã phê duyệt' || chamCong.trang_thai_lam_them === 'Từ chối') {
      return res.status(400).json({
        message: 'Tăng ca của bản ghi này đã được xử lý, không thể phê duyệt lại.'
      });
    }

    const newStatus = action === 'approve' ? 'Đã phê duyệt' : 'Từ chối';

    chamCong.trang_thai_lam_them = newStatus;
    chamCong.nguoi_phe_duyet_lam_them_did = req.user?.employee_did;
    chamCong.ngay_phe_duyet_lam_them = new Date();
    chamCong.ly_do_lam_them = ly_do_lam_them;

    await chamCong.save();

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: req.user?.employee_did || 'admin',
      action: 'APPROVE_OVERTIME',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        before: { trang_thai_lam_them: chamCong.trang_thai_lam_them },
        after: { trang_thai_lam_them: newStatus }
      },
      status: 'Success',
      details: `Overtime ${action}d for ${chamCong.employee_did} on ${chamCong.ngay.toISOString().split('T')[0]}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    res.json(chamCong);
  } catch (error) {
    console.error('Approve overtime error:', error);
    res.status(400).json({ message: error.message });
  }
};

const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, ly_do_nghi } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject"' });
    }

    const chamCong = await ChamCong.findById(id);
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Không cho phép thay đổi nếu nghỉ phép đã được phê duyệt hoặc từ chối trước đó
    if (chamCong.trang_thai_nghi_phep === 'Đã phê duyệt' || chamCong.trang_thai_nghi_phep === 'Từ chối') {
      return res.status(400).json({
        message: 'Nghỉ phép của bản ghi này đã được xử lý, không thể phê duyệt lại.'
      });
    }

    const newStatus = action === 'approve' ? 'Đã phê duyệt' : 'Từ chối';

    chamCong.trang_thai_nghi_phep = newStatus;
    chamCong.trang_thai_phe_duyet = newStatus;
    chamCong.nguoi_phe_duyet_nghi_did = req.user?.employee_did;
    chamCong.ngay_phe_duyet_nghi = new Date();
    chamCong.ly_do_nghi = ly_do_nghi;

    await chamCong.save();

    // Create audit log
    const auditLog = new AuditLogs({
      user_did: req.user?.employee_did || 'admin',
      action: 'APPROVE_LEAVE',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        before: { trang_thai_nghi_phep: chamCong.trang_thai_nghi_phep },
        after: { trang_thai_nghi_phep: newStatus }
      },
      status: 'Success',
      details: `Leave ${action}d for ${chamCong.employee_did} on ${chamCong.ngay.toISOString().split('T')[0]}`,
      timestamp: new Date(),
      ip_address: req.ip
    });
    await auditLog.save();

    res.json(chamCong);
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(400).json({ message: error.message });
  }
};

const bulkUpdateAttendance = async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Records array is required and cannot be empty' });
    }

    const results = [];
    const errors = [];

    for (const record of records) {
      try {
        const { id, ...updateData } = record;

        if (!id) {
          errors.push({ record, error: 'Missing id field' });
          continue;
        }

        const chamCong = await ChamCong.findById(id);
        if (!chamCong) {
          errors.push({ record, error: 'Attendance record not found' });
          continue;
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
          if (updateData[key] !== undefined) {
            chamCong[key] = updateData[key];
          }
        });

        chamCong.nhap_thu_cong = true;
        chamCong.nguoi_nhap_did = req.user?.employee_did;
        chamCong.ngay_nhap = new Date();

        await chamCong.save();
        results.push(chamCong);

        // Create audit log
        const auditLog = new AuditLogs({
          user_did: req.user?.employee_did || 'admin',
          action: 'BULK_UPDATE',
          resource_type: 'cham_cong',
          resource_id: chamCong._id.toString(),
          changes: {
            before: null,
            after: updateData
          },
          status: 'Success',
          details: `Bulk update attendance record for ${chamCong.employee_did}`,
          timestamp: new Date(),
          ip_address: req.ip
        });
        await auditLog.save();

      } catch (recordError) {
        errors.push({ record, error: recordError.message });
      }
    }

    res.json({
      message: `Processed ${records.length} records. Success: ${results.length}, Errors: ${errors.length}`,
      results,
      errors
    });
  } catch (error) {
    console.error('Bulk update attendance error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getPendingApprovals = async (req, res) => {
  try {
    const pendingRecords = await ChamCong.find({
      $or: [
        { trang_thai_phe_duyet: 'Chờ phê duyệt' },
        { trang_thai_lam_them: 'Chờ phê duyệt' },
        { trang_thai_nghi_phep: 'Chờ phê duyệt' }
      ]
    }).sort({ ngay: -1 });

    res.json(pendingRecords);
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, departmentId, employeeDid } = req.query;

    let matchConditions = {};

    // Date range filter
    if (startDate && endDate) {
      matchConditions.ngay = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Employee filter
    if (employeeDid) {
      matchConditions.employee_did = employeeDid;
    }

    // Department filter (requires join with employee data)
    let departmentFilter = {};
    if (departmentId) {
      const HoSoNhanVien = require('../models/HoSoNhanVien');
      const employeesInDept = await HoSoNhanVien.find({ phong_ban_id: departmentId }, { employee_did: 1 });
      const employeeDids = employeesInDept.map(emp => emp.employee_did);
      matchConditions.employee_did = { $in: employeeDids };
    }

    const report = await ChamCong.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: {
            employee_did: '$employee_did',
            month: { $dateToString: { format: '%Y-%m', date: '$ngay' } }
          },
          totalRecords: { $sum: 1 },
          totalWorkingDays: {
            $sum: {
              $cond: [
                { $or: [
                  { $eq: ['$trang_thai_phe_duyet', 'Đã phê duyệt'] },
                  { $eq: ['$trang_thai_phe_duyet', 'Không cần phê duyệt'] }
                ]},
                1,
                0
              ]
            }
          },
          totalOvertimeHours: {
            $sum: {
              $cond: [
                { $eq: ['$trang_thai_lam_them', 'Đã phê duyệt'] },
                '$gio_lam_them',
                0
              ]
            }
          },
          totalLeaveDays: {
            $sum: {
              $cond: [
                { $eq: ['$trang_thai_nghi_phep', 'Đã phê duyệt'] },
                '$so_ngay_nghi',
                0
              ]
            }
          },
          totalWorkingHours: { $sum: '$tong_gio_lam' }
        }
      },
      {
        $project: {
          employee_did: '$_id.employee_did',
          month: '$_id.month',
          totalRecords: 1,
          totalWorkingDays: 1,
          totalOvertimeHours: 1,
          totalLeaveDays: 1,
          totalWorkingHours: 1,
          averageWorkingHours: {
            $cond: [
              { $gt: ['$totalWorkingDays', 0] },
              { $divide: ['$totalWorkingHours', '$totalWorkingDays'] },
              0
            ]
          }
        }
      },
      { $sort: { month: -1, employee_did: 1 } }
    ]);

    res.json(report);
  } catch (error) {
    console.error('Get attendance report error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Nhân viên báo quên check-out:
 * - Yêu cầu đã check-in nhưng chưa check-out trong ngày
 * - Gửi mô tả công việc, số giờ ước tính và bằng chứng (URL)
 * - Hệ thống lưu lại để admin xem và phê duyệt sau
 */
const reportMissedCheckout = async (req, res) => {
  try {
    const {
      employee_did,
      ngay,
      mo_ta,
      gio_xac_nhan,
      bang_chung = []
    } = req.body;

    if (!employee_did || !ngay) {
      return res.status(400).json({
        message: 'Thiếu thông tin: employee_did, ngay là bắt buộc'
      });
    }

    const attendanceDate = new Date(ngay);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Định dạng ngày không hợp lệ. Dùng YYYY-MM-DD' });
    }

    const chamCong = await ChamCong.findOne({ employee_did, ngay: attendanceDate });
    if (!chamCong) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi chấm công để báo quên check-out' });
    }

    if (!chamCong.gio_vao) {
      return res.status(400).json({ message: 'Bạn chưa check-in ngày này nên không thể báo quên check-out' });
    }

    if (chamCong.gio_ra) {
      return res.status(400).json({ message: 'Ngày này đã có giờ check-out, không thể báo quên check-out' });
    }

    // Chuẩn hóa số giờ xác nhận (tùy chọn)
    let confirmedHours = null;
    if (gio_xac_nhan !== undefined && gio_xac_nhan !== null) {
      const parsedHours = Number(gio_xac_nhan);
      if (isNaN(parsedHours) || parsedHours < 0) {
        return res.status(400).json({ message: 'Số giờ xác nhận không hợp lệ' });
      }
      confirmedHours = parsedHours;
    }

    chamCong.quen_checkout_bao_cao = true;
    chamCong.quen_checkout_mo_ta = mo_ta || null;
    chamCong.quen_checkout_bang_chung = Array.isArray(bang_chung) ? bang_chung : [];
    chamCong.quen_checkout_trang_thai = 'Chờ phê duyệt';
    chamCong.quen_checkout_gio_xac_nhan = confirmedHours;

    await chamCong.save();

    // Tạo audit log
    await AuditLogs.create({
      user_did: employee_did,
      action: 'REPORT_MISSED_CHECKOUT',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        after: {
          quen_checkout_bao_cao: true,
          quen_checkout_trang_thai: 'Chờ phê duyệt',
          quen_checkout_gio_xac_nhan: confirmedHours,
          quen_checkout_mo_ta: mo_ta
        }
      },
      status: 'Success',
      details: `Nhân viên báo quên check-out cho ngày ${attendanceDate.toISOString().split('T')[0]}`,
      timestamp: new Date(),
      ip_address: req.ip
    });

    return res.json({
      success: true,
      message: 'Đã gửi báo cáo quên check-out. Vui lòng chờ admin phê duyệt.',
      data: chamCong
    });
  } catch (error) {
    console.error('reportMissedCheckout error:', error);
    return res.status(500).json({ message: error.message || 'Lỗi khi gửi báo cáo quên check-out' });
  }
};

/**
 * Admin phê duyệt trường hợp quên check-out:
 * - action: 'approve' | 'reject'
 * - Nếu approve: dùng số giờ xác nhận (hoặc tong_gio_lam) để tính lương với hệ số 50% và thanh toán
 * - Nếu reject: lương = 0, đánh dấu là nghỉ phép (Nghỉ không lương)
 */
const approveMissedCheckout = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, ly_do_admin, gio_xac_nhan } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action phải là "approve" hoặc "reject"' });
    }

    const chamCong = await ChamCong.findById(id);
    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (!chamCong.quen_checkout_bao_cao || chamCong.quen_checkout_trang_thai === 'Không áp dụng') {
      return res.status(400).json({ message: 'Bản ghi này không có báo cáo quên check-out' });
    }

    // Không cho phép thay đổi nếu báo quên check-out đã được phê duyệt hoặc từ chối trước đó
    if (chamCong.quen_checkout_trang_thai === 'Đã phê duyệt' || chamCong.quen_checkout_trang_thai === 'Từ chối') {
      return res.status(400).json({
        message: 'Báo quên check-out của bản ghi này đã được xử lý, không thể phê duyệt lại.'
      });
    }

    const dateString = chamCong.ngay.toISOString().split('T')[0];
    const MIN_REQUIRED_HOURS = 5;

    // Xác định số giờ được chấp nhận
    let approvedHours = chamCong.quen_checkout_gio_xac_nhan || chamCong.tong_gio_lam || 0;
    if (gio_xac_nhan !== undefined && gio_xac_nhan !== null) {
      const parsed = Number(gio_xac_nhan);
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ message: 'Số giờ xác nhận không hợp lệ' });
      }
      approvedHours = parsed;
    }

    let paymentResult = null;

    if (action === 'approve') {
      // Cập nhật số giờ làm được chấp nhận
      chamCong.tong_gio_lam = Math.round(approvedHours * 100) / 100;

      // Mặc định không có tăng ca trong trường hợp này
      chamCong.gio_lam_them = 0;
      chamCong.trang_thai_lam_them = 'Không áp dụng';

      // Tính lương với hệ số 50% (cho trường hợp quên check-out đã được phê duyệt)
      // Không áp dụng điều kiện tối thiểu 5 giờ cho trường hợp này
      const basePay = approvedHours * REGULAR_HOURLY_RATE;
      const payWithPenalty = basePay * 0.5;
      const calculatedSalary = Number(payWithPenalty.toFixed(2));
      
      // Kiểm tra điều kiện tối thiểu 5 giờ chỉ để cảnh báo, không chặn tính lương
      const isBelowMinimum = approvedHours < MIN_REQUIRED_HOURS;
      if (isBelowMinimum) {
        console.warn(`[approveMissedCheckout] Approved hours (${approvedHours}h) below minimum ${MIN_REQUIRED_HOURS}h, but still calculating salary with 50% penalty for missed checkout.`);
      }
      
      // Cập nhật lương trước khi thanh toán
      chamCong.luong_tinh_theo_gio = calculatedSalary;

      // Thực hiện thanh toán qua smart contract
      try {
        const attendancePaymentService = require('../services/attendancePaymentService');
        paymentResult = await attendancePaymentService.payAttendanceSalary(
          chamCong.employee_did,
          dateString,
          approvedHours,
          { customAmountUsdt: calculatedSalary }
        );

        if (paymentResult && paymentResult.success) {
          chamCong.salary_transaction_hash = paymentResult.transactionHash;
          console.log(`[approveMissedCheckout] Payment successful. TX: ${paymentResult.transactionHash}, Amount: ${calculatedSalary} USDT`);
        } else {
          console.warn('[approveMissedCheckout] Payment returned but not successful:', paymentResult);
          paymentResult = paymentResult || {
            success: false,
            message: 'Thanh toán không thành công'
          };
        }
      } catch (paymentError) {
        console.error('[approveMissedCheckout] Payment error:', paymentError);
        paymentResult = {
          success: false,
          message: paymentError.message || 'Thanh toán thất bại',
          error: paymentError.stack
        };
        // Vẫn tiếp tục lưu lương và trạng thái phê duyệt ngay cả khi thanh toán thất bại
        // Admin có thể thanh toán lại sau
      }

      // Cập nhật trạng thái phê duyệt
      chamCong.quen_checkout_trang_thai = 'Đã phê duyệt';
      chamCong.trang_thai_phe_duyet = 'Đã phê duyệt';
      chamCong.nguoi_phe_duyet_did = req.user?.employee_did;
      chamCong.ngay_phe_duyet = new Date();
      chamCong.ghi_chu_admin = ly_do_admin || chamCong.ghi_chu_admin;
      
      // Đảm bảo cập nhật trạng thái chấm công
      if (!chamCong.gio_ra) {
        chamCong.trang_thai_cham_cong = 'Tạm ngưng';
      }
    } else {
      // Từ chối: lương = 0, đánh dấu là nghỉ không lương
      chamCong.quen_checkout_trang_thai = 'Từ chối';
      chamCong.luong_tinh_theo_gio = 0;
      chamCong.tong_gio_lam = 0;
      chamCong.loai_ngay = 'Nghỉ phép';
      chamCong.loai_nghi_phep = 'Nghỉ không lương';
      chamCong.so_ngay_nghi = 1;
      chamCong.trang_thai_nghi_phep = 'Đã phê duyệt';
      chamCong.trang_thai_phe_duyet = 'Đã phê duyệt';
      chamCong.nguoi_phe_duyet_did = req.user?.employee_did;
      chamCong.ngay_phe_duyet = new Date();
      chamCong.ghi_chu_admin = ly_do_admin || chamCong.ghi_chu_admin;
    }

    // Log thông tin trước khi lưu
    console.log(`[approveMissedCheckout] Saving attendance record:`, {
      employee_did: chamCong.employee_did,
      date: dateString,
      tong_gio_lam: chamCong.tong_gio_lam,
      luong_tinh_theo_gio: chamCong.luong_tinh_theo_gio,
      quen_checkout_trang_thai: chamCong.quen_checkout_trang_thai,
      salary_transaction_hash: chamCong.salary_transaction_hash
    });

    await chamCong.save();

    // Verify saved data
    const savedRecord = await ChamCong.findById(chamCong._id);
    console.log(`[approveMissedCheckout] Saved record verified:`, {
      tong_gio_lam: savedRecord.tong_gio_lam,
      luong_tinh_theo_gio: savedRecord.luong_tinh_theo_gio,
      quen_checkout_trang_thai: savedRecord.quen_checkout_trang_thai
    });

    // Audit log
    await AuditLogs.create({
      user_did: req.user?.employee_did || 'admin',
      action: 'APPROVE_MISSED_CHECKOUT',
      resource_type: 'cham_cong',
      resource_id: chamCong._id.toString(),
      changes: {
        after: {
          quen_checkout_trang_thai: chamCong.quen_checkout_trang_thai,
          tong_gio_lam: chamCong.tong_gio_lam,
          luong_tinh_theo_gio: chamCong.luong_tinh_theo_gio,
          salary_transaction_hash: chamCong.salary_transaction_hash
        }
      },
      status: paymentResult?.success ? 'Success' : 'Partial Success',
      details: `Admin ${action} báo cáo quên check-out cho ${chamCong.employee_did} ngày ${dateString}. ` +
               `Lương: ${chamCong.luong_tinh_theo_gio} USDT. ` +
               `Thanh toán: ${paymentResult?.success ? 'Thành công' : 'Thất bại'}`,
      timestamp: new Date(),
      ip_address: req.ip
    });

    return res.json({
      success: true,
      message: action === 'approve'
        ? 'Đã phê duyệt báo cáo quên check-out'
        : 'Đã từ chối báo cáo quên check-out và đánh dấu nghỉ phép',
      payment: paymentResult,
      data: chamCong
    });
  } catch (error) {
    console.error('approveMissedCheckout error:', error);
    return res.status(500).json({ message: error.message || 'Lỗi khi phê duyệt báo cáo quên check-out' });
  }
};
const payAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const chamCong = await ChamCong.findById(id);

    if (!chamCong) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (!chamCong.gio_ra || !chamCong.tong_gio_lam || chamCong.tong_gio_lam <= 0) {
      return res.status(400).json({ message: 'Attendance record is not complete or has no working hours' });
    }

    // Không cho phép thanh toán thủ công nếu tổng giờ làm < 5
    if (chamCong.tong_gio_lam < 5) {
      return res.status(400).json({
        message: `Số giờ làm (${chamCong.tong_gio_lam.toFixed(
          2
        )}h) chưa đạt yêu cầu tối thiểu 5 giờ, hệ thống sẽ không thanh toán lương cho ngày này.`
      });
    }

    const attendancePaymentService = require('../services/attendancePaymentService');
    const dateValue = chamCong.ngay instanceof Date ? chamCong.ngay : new Date(chamCong.ngay);
    const dateString = dateValue.toISOString().split('T')[0];

    const paymentResult = await attendancePaymentService.payAttendanceSalary(
      chamCong.employee_did,
      dateString,
      chamCong.tong_gio_lam,
      { customAmountUsdt: chamCong.luong_tinh_theo_gio }
    );

    if (paymentResult.success && paymentResult.transactionHash) {
      chamCong.salary_transaction_hash = paymentResult.transactionHash;
      await chamCong.save();
    }

    return res.json({
      success: paymentResult.success,
      message: paymentResult.message || (paymentResult.success ? 'Payment successful' : 'Payment failed'),
      payment: paymentResult,
      recordId: id
    });
  } catch (error) {
    console.error('payAttendanceRecord error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAll,
  getById,
  getByEmployee,
  getByDateRange,
  getByEmployeeAndDate,
  create,
  update,
  delete: deleteAttendance,
  checkIn,
  checkOut,
  // Admin functions
  createManualAttendance,
  updateManualAttendance,
  approveAttendance,
  approveOvertime,
  approveLeave,
  bulkUpdateAttendance,
  getPendingApprovals,
  getAttendanceReport,
  payAttendanceRecord,
  reportMissedCheckout,
  approveMissedCheckout
};
