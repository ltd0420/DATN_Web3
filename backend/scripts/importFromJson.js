const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import all models
const DanhMucPhongBan = require('../models/DanhMucPhongBan');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const ChamCong = require('../models/ChamCong');
const DanhGiaKpi = require('../models/DanhGiaKpi');
const PhanHoiKhachHang = require('../models/PhanHoiKhachHang');
const XepHangNhanVien = require('../models/XepHangNhanVien');
const LuongThuong = require('../models/LuongThuong');
const SmartContractLogs = require('../models/SmartContractLogs');
const AuditLogs = require('../models/AuditLogs');
const QrAuthentication = require('../models/QrAuthentication');
const AiModelMetadata = require('../models/AiModelMetadata');
const EventLogsUser = require('../models/EventLogsUser');

// Map collection names to models
const modelMap = {
  'danh_muc_phong_ban': DanhMucPhongBan,
  'ho_so_nhan_vien': HoSoNhanVien,
  'cham_cong': ChamCong,
  'danh_gia_kpi': DanhGiaKpi,
  'phan_hoi_khach_hang': PhanHoiKhachHang,
  'xep_hang_nhan_vien': XepHangNhanVien,
  'luong_thuong': LuongThuong,
  'smart_contract_logs': SmartContractLogs,
  'audit_logs': AuditLogs,
  'qr_authentication': QrAuthentication,
  'ai_model_metadata': AiModelMetadata,
  'event_logs_user': EventLogsUser
};

async function importData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/web3-hrm';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Read the JSON schema file
    const schemaPath = path.join(__dirname, '../../full_schema_updated.json');
    const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    // Process each collection
    for (const collection of schemaData.collections) {
      const collectionName = collection._id;
      const model = modelMap[collectionName];

      if (!model) {
        console.log(`Model not found for collection: ${collectionName}`);
        continue;
      }

      const sampleData = collection.public.node_data.jsonSample;

      if (sampleData && sampleData.length > 0) {
        console.log(`Importing ${sampleData.length} records to ${collectionName}...`);

        // Clear existing data (optional - remove this line if you want to keep existing data)
        await model.deleteMany({});

        // Insert sample data
        for (const record of sampleData) {
          try {
            // Remove MongoDB _id if present (let MongoDB generate it)
            if (record._id) {
              delete record._id;
            }

            // Convert date strings to Date objects where needed
            if (record.createdAt) record.createdAt = new Date(record.createdAt);
            if (record.updatedAt) record.updatedAt = new Date(record.updatedAt);
            if (record.timestamp) record.timestamp = new Date(record.timestamp);
            if (record.ngay_phan_hoi) record.ngay_phan_hoi = new Date(record.ngay_phan_hoi);
            if (record.ngay_thanh_toan) record.ngay_thanh_toan = new Date(record.ngay_thanh_toan);
            if (record.last_trained) record.last_trained = new Date(record.last_trained);
            if (record.lan_su_dung_cuoi) record.lan_su_dung_cuoi = new Date(record.lan_su_dung_cuoi);

            const newRecord = new model(record);
            await newRecord.save();
          } catch (error) {
            console.error(`Error importing record to ${collectionName}:`, error.message);
          }
        }

        console.log(`Successfully imported data to ${collectionName}`);
      } else {
        console.log(`No sample data found for ${collectionName}`);
      }
    }

    console.log('Data import completed successfully!');
  } catch (error) {
    console.error('Error during data import:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  importData();
}

module.exports = { importData };
