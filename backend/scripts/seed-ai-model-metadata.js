#!/usr/bin/env node
/**
 * Seed ai_model_metadata collection with synthetic records that follow schema.json.
 *
 * Usage:
 *   node scripts/seed-ai-model-metadata.js           # insert 1,000,000 records
 *   node scripts/seed-ai-model-metadata.js --count 5000
 *   node scripts/seed-ai-model-metadata.js --purge   # delete every record before seeding
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../config/db');
const AiModelMetadata = require('../models/AiModelMetadata');

const DEFAULT_TOTAL = 1_000_000;
const BATCH_SIZE = 5000;

const CAC_LOAI_MO_HINH = ['BERT', 'CNN', 'Hybrid'];
const CAC_TRANG_THAI = ['Active', 'Testing', 'Deprecated'];
const CAC_TRUONG_HOP_SU_DUNG = [
  'Dự báo nghỉ việc',
  'Phát hiện burnout',
  'Dự đoán khiếu nại nội bộ',
  'Dự báo yêu cầu tăng lương',
  'Chấm điểm khảo sát gắn kết',
  'Dự đoán KPI sắp tới',
  'Phân tích cảm xúc phản hồi khách hàng',
  'Dự báo tham gia đào tạo',
  'Cảnh báo tăng ca bất thường',
  'Theo dõi trượt hiệu suất',
];

const CAC_GIOI_TINH = ['Nam', 'Nữ', 'Khác'];
const CAC_TRINH_DO = ['Trung cấp', 'Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ'];
const CAC_TINH_TRANG_HON_NHAN = ['Độc thân', 'Đã kết hôn', 'Khác'];
const CAC_PHONG_BAN = [
  'Kỹ thuật',
  'Sản phẩm',
  'Nhân sự',
  'Tài chính',
  'Kinh doanh',
  'Marketing',
  'Vận hành',
  'Chăm sóc khách hàng',
];
const CAC_VAI_TRO = [
  'Lập trình Backend',
  'Lập trình Frontend',
  'Nhà khoa học dữ liệu',
  'Kỹ sư QA',
  'Quản lý sản phẩm',
  'Chuyên viên nhân sự',
  'Chuyên viên kinh doanh',
  'Kỹ sư DevOps',
  'Thiết kế UI/UX',
  'Chuyên viên phân tích nghiệp vụ',
];
const CAC_CAP_BAC = ['Thực tập', 'Junior', 'Middle', 'Senior', 'Lead', 'Manager', 'Director'];
const CAC_XEP_LOAI = ['Xuất sắc', 'Tốt', 'Đạt', 'Chưa đạt'];
const CAC_KET_QUA_KHAO_SAT = ['Rất hài lòng', 'Hài lòng', 'Trung lập', 'Không hài lòng', 'Rất không hài lòng'];

const args = process.argv.slice(2);
const countIdx = args.indexOf('--count');
const requestedTotal = countIdx >= 0 ? Number(args[countIdx + 1]) : undefined;
const totalRecords = Number.isFinite(requestedTotal) && requestedTotal > 0 ? requestedTotal : DEFAULT_TOTAL;
const shouldPurge = args.includes('--purge');

async function main() {
  await connectDB();

  if (shouldPurge) {
    const deleted = await AiModelMetadata.deleteMany({});
    console.log(`[Purge] removed ${deleted.deletedCount} existing records`);
  }

  const existingCount = await AiModelMetadata.estimatedDocumentCount();
  console.log(
    `Seeding ${totalRecords} ai_model_metadata documents (current total: ${existingCount})...`,
  );
  let inserted = 0;

  for (let start = 0; start < totalRecords; start += BATCH_SIZE) {
    const batch = [];
    const remaining = Math.min(BATCH_SIZE, totalRecords - start);
    for (let i = 0; i < remaining; i += 1) {
      const globalIndex = start + i + 1;
      const absoluteIndex = existingCount + globalIndex;
      batch.push(buildRecord(absoluteIndex));
    }
    await AiModelMetadata.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${totalRecords}`);
  }

  const newTotal = existingCount + inserted;
  console.log(`\nSeeding completed successfully. Total documents: ${newTotal}`);
  await mongoose.connection.close();
  process.exit(0);
}

function buildRecord(index) {
  const loaiMoHinh = chonNgauNhien(CAC_LOAI_MO_HINH);
  const ungDung = chonNgauNhien(CAC_TRUONG_HOP_SU_DUNG);
  const trangThai = chonTrangThai();

  const accuracy = randomFloat(0.78, 0.98);
  const f1 = Math.max(0.7, Number((accuracy - randomFloat(0.0, 0.05)).toFixed(4)));
  const trainedDate = randomDateWithinDays(540);

  const tenMoHinh = `MoHinhNhanSu-${String(index).padStart(5, '0')}`;
  const phienBan = `v${1 + Math.floor(index / 1000)}.${(index % 1000) + 1}.0`;
  const duLieuGiaLap = taoBanGhiGiaLap(index);

  return {
    ten_mo_hinh: tenMoHinh,
    phien_ban: phienBan,
    loai_mo_hinh: loaiMoHinh,
    ung_dung: ungDung,
    tom_tat_du_lieu: [
      'Bao gồm 4 nhóm dữ liệu: thông tin cá nhân, công việc, hiệu suất, thái độ & phúc lợi',
      `Ví dụ nhân viên: ${duLieuGiaLap.thong_tin_ca_nhan.ma_nhan_vien}, phòng ${duLieuGiaLap.thong_tin_ca_nhan.phong_ban}, vai trò ${duLieuGiaLap.thong_tin_cong_viec.vi_tri_cong_viec}`,
    ].join('. ') + '.',
    accuracy: Number(accuracy.toFixed(4)),
    f1_score: Number(f1.toFixed(4)),
    mo_ta_model_uri: `https://models.hr.local/${slugify(ungDung)}/${tenMoHinh}/${phienBan}`,
    last_trained: trainedDate,
    trang_thai: trangThai,
    du_lieu_gia_lap: duLieuGiaLap,
  };
}

function chonNgauNhien(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function taoBanGhiGiaLap(index) {
  const employeeId = `NV-${String(index).padStart(6, '0')}`;
  const department = chonNgauNhien(CAC_PHONG_BAN);
  const jobRole = chonNgauNhien(CAC_VAI_TRO);
  const jobLevel = chonNgauNhien(CAC_CAP_BAC);
  const currentSalary = randomInt(8, 80) * 1_000_000;
  const lastRaise = Number(randomFloat(0, 15).toFixed(2));
  const hoursPerWeek = randomInt(35, 55);
  const overtimeHours = randomInt(0, 30);
  const activeProjects = randomInt(1, 6);
  const managerId = `QL-${randomInt(100, 999)}`;

  const kpiScore = Number(randomFloat(60, 100).toFixed(2));
  const performanceRating = chonNgauNhien(CAC_XEP_LOAI);
  const trainingHours = randomInt(5, 120);
  const promotionCount = randomInt(0, 4);
  const monthsSincePromotion = promotionCount === 0 ? null : randomInt(1, 48);

  const jobSatisfaction = randomInt(1, 5);
  const workLifeBalance = randomInt(1, 5);
  const leaveDays = randomInt(5, 20);
  const lateCount = randomInt(0, 12);
  const engagementScore = Number(randomFloat(50, 100).toFixed(1));
  const surveyResult = chonNgauNhien(CAC_KET_QUA_KHAO_SAT);

  return {
    thong_tin_ca_nhan: {
      ma_nhan_vien: employeeId,
      tuoi: randomInt(21, 60),
      gioi_tinh: chonNgauNhien(CAC_GIOI_TINH),
      trinh_do_hoc_van: chonNgauNhien(CAC_TRINH_DO),
      tinh_trang_hon_nhan: chonNgauNhien(CAC_TINH_TRANG_HON_NHAN),
      so_nam_lam_viec: Number(randomFloat(0.2, 12).toFixed(1)),
      phong_ban: department,
    },
    thong_tin_cong_viec: {
      vi_tri_cong_viec: jobRole,
      cap_bac: jobLevel,
      muc_luong_hien_tai: currentSalary,
      tang_luong_nam_truoc: lastRaise,
      so_gio_moi_tuan: hoursPerWeek,
      gio_ot: overtimeHours,
      so_du_an_tham_gia: activeProjects,
      ma_quan_ly: managerId,
    },
    thong_tin_hieu_suat: {
      diem_kpi: kpiScore,
      xep_loai_hieu_suat: performanceRating,
      gio_dao_tao: trainingHours,
      so_lan_thang_chuc: promotionCount,
      thang_tu_lan_thang_chuc_cuoi: monthsSincePromotion,
    },
    thai_do_phuc_loi: {
      muc_do_hai_long: jobSatisfaction,
      can_bang_cong_viec: workLifeBalance,
      so_ngay_nghi_phep: leaveDays,
      so_lan_di_muon: lateCount,
      diem_gan_ket: engagementScore,
      ket_qua_khao_sat: surveyResult,
    },
  };
}

function chonTrangThai() {
  const roll = Math.random();
  if (roll < 0.65) return 'Active';
  if (roll < 0.9) return 'Testing';
  return 'Deprecated';
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinDays(days) {
  const now = Date.now();
  const offset = randomInt(0, days) * 24 * 3600 * 1000;
  return new Date(now - offset);
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

main().catch(async (error) => {
  console.error('\nSeeding failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});

