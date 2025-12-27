const mongoose = require('mongoose');
require('dotenv').config();

const ChamCong = require('../models/ChamCong');
const DanhGiaKpi = require('../models/DanhGiaKpi');

const SAMPLE_EMPLOYEE_DID = process.env.MOCK_EMPLOYEE_DID || '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7c';
const SAMPLE_MANAGER_DID = process.env.MOCK_MANAGER_DID || '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b';

const attendanceRecord = {
  employee_did: SAMPLE_EMPLOYEE_DID,
  ngay: new Date('2024-10-31'),
  gio_vao: '08:00:00',
  gio_ra: '17:00:00',
  tong_gio_lam: 160,
  loai_ngay: 'Ngày thường',
  ghi_chu: 'Mock record for payroll calculations',
  xac_thuc_qua: 'Web App',
  trang_thai_phe_duyet: 'Không cần phê duyệt',
  nhap_thu_cong: true,
  nguoi_nhap_did: SAMPLE_MANAGER_DID,
  ngay_nhap: new Date()
};

const kpiRecord = {
  employee_did: SAMPLE_EMPLOYEE_DID,
  kpi_id: '11111111-2222-3333-4444-555555555555',
  ky_danh_gia: '2024-Q4',
  ngay_bat_dau: new Date('2024-10-01'),
  ngay_ket_thuc: new Date('2024-12-31'),
  gia_tri_thuc_te: 100,
  diem_so: 95,
  xep_loai: 'Xuất sắc',
  nguoi_danh_gia_did: SAMPLE_MANAGER_DID,
  nhan_xet: 'Mock KPI evaluation for payroll prototype',
  trang_thai: 'Đã phê duyệt'
};

async function seedMockData() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Missing MONGODB_URI in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const attendance = await ChamCong.findOneAndUpdate(
      { employee_did: attendanceRecord.employee_did, ngay: attendanceRecord.ngay },
      { $set: attendanceRecord },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✅ Attendance mock data ready:', {
      employee_did: attendance.employee_did,
      ngay: attendance.ngay.toISOString().split('T')[0],
      tong_gio_lam: attendance.tong_gio_lam
    });

    const kpi = await DanhGiaKpi.findOneAndUpdate(
      {
        employee_did: kpiRecord.employee_did,
        kpi_id: kpiRecord.kpi_id,
        ky_danh_gia: kpiRecord.ky_danh_gia
      },
      { $set: kpiRecord },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✅ KPI mock data ready:', {
      employee_did: kpi.employee_did,
      ky_danh_gia: kpi.ky_danh_gia,
      diem_so: kpi.diem_so,
      xep_loai: kpi.xep_loai
    });

    console.log('\n🎯 Mock data seeding finished.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedMockData();

