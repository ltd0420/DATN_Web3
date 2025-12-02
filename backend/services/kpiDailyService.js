// Note: KpiTieuChi and KpiMucTieu models have been removed
// const KpiTieuChi = require('../models/KpiTieuChi');
// const KpiMucTieu = require('../models/KpiMucTieu');
const CongViecGiao = require('../models/CongViecGiao');

// Optional model - only require if it exists
let DanhGiaKpi;
try {
  DanhGiaKpi = require('../models/DanhGiaKpi');
} catch (e) {
  DanhGiaKpi = null;
}

/**
 * Chuẩn hóa ngày về 00:00:00 và trả về { date, year, month, day, key }
 * key dùng làm ky_danh_gia/ky_luong theo định dạng YYYY-MM-DD
 */
const normalizeDate = (dateInput) => {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Ngày không hợp lệ. Định dạng chuẩn: YYYY-MM-DD');
  }
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date, year, month, day, key };
};

/**
 * Tính điểm KPI cho 1 tiêu chí:
 * - muc_tieu > 0: diem = min( (gia_tri_thuc_te / muc_tieu) * 100, 120 ) rồi giới hạn 0-100
 * - Xếp loại theo điểm:
 *   >= 90: Xuất sắc
 *   >= 75: Tốt
 *   >= 60: Đạt
 *   <  60: Chưa đạt
 */
const calculateScoreAndClassification = (actualValue, targetValue) => {
  let diem_so = 0;

  if (typeof actualValue === 'number' && typeof targetValue === 'number' && targetValue > 0) {
    const ratio = actualValue / targetValue;
    const raw = ratio * 100;
    // Cho phép vượt nhẹ nhưng giới hạn 0-100 theo schema
    diem_so = Math.max(0, Math.min(100, Number(raw.toFixed(2))));
  }

  let xep_loai = 'Chưa đạt';
  if (diem_so >= 90) {
    xep_loai = 'Xuất sắc';
  } else if (diem_so >= 75) {
    xep_loai = 'Tốt';
  } else if (diem_so >= 60) {
    xep_loai = 'Đạt';
  }

  return { diem_so, xep_loai };
};

/**
 * Lấy giá trị thực tế cho 1 KPI trong 1 ngày dựa trên task:
 * - Đếm số task đã hoàn thành trong ngày, có liên_ket_kpi_id = kpi_id
 */
const getActualValueFromTasks = async (employeeDid, kpiId, dayStart) => {
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const count = await CongViecGiao.countDocuments({
    nguoi_thuc_hien_did: employeeDid,
    lien_ket_kpi_id: kpiId,
    trang_thai: 'Hoàn thành',
    ngay_hoan_thanh_thuc_te: {
      $gte: dayStart,
      $lt: dayEnd
    }
  });

  return count;
};

/**
 * Đánh giá KPI theo ngày cho 1 nhân viên:
 * - NOTE: Function disabled because KpiTieuChi and KpiMucTieu models have been removed
 * - This function is kept for reference but will return empty results
 */
const evaluateDailyKpiForEmployee = async (employeeDid, dateString, options = {}) => {
  const { date, year, month, day, key } = normalizeDate(dateString);

  // Return empty result since KPI Criteria and Targets setup has been removed
  return {
    employee_did: employeeDid,
    date: key,
    evaluations: [],
    overallScore: 0
  };
};

module.exports = {
  normalizeDate,
  calculateScoreAndClassification,
  getActualValueFromTasks,
  evaluateDailyKpiForEmployee
};


