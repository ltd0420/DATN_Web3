const mongoose = require('mongoose');

const HoSoNhanVienSchema = new mongoose.Schema({
  employee_did: {
    type: String,
    required: [true, 'Mã định danh nhân viên là bắt buộc'],
    unique: true,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã định danh (employee_did) không hợp lệ.']
  },
  chuc_vu: {
    type: String,
    required: true,
    enum: [
      "Intern", "Junior Developer", "Senior Developer", "Tech Lead", "Designer",
      "QA Engineer", "DevOps Engineer", "Data Engineer", "Data Scientist",
      "Product Manager", "Project Manager", "HR Specialist", "Finance Analyst",
      "Sales Executive", "Customer Support", "Marketing Specialist", "Team Lead",
      "Manager", "Director", "VP", "CTO", "CFO", "COO", "CEO"
    ]
  },
  phong_ban_id: {
    type: String,
    required: false,
    // The schema specifies a UUID string, not an ObjectId reference.
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Định dạng mã phòng ban (phong_ban_id) không hợp lệ.']
  },
  trang_thai: {
    type: String,
    required: true,
    enum: ["Đang làm việc", "Nghỉ phép", "Tạm nghỉ", "Đã nghỉ việc"],
    default: "Đang làm việc"
  },
  ngay_vao_lam: {
    type: Date,
    required: false // Not required in the new schema
  },
  vc_uris: [{
    type: String,
    // FIX: Escaped forward slashes in the regex to prevent parsing errors.
    match: [/^(ipfs|https):\/\/.*/, 'URI không hợp lệ, phải bắt đầu bằng ipfs:// hoặc https://']
  }],
  consent_pointer: {
    type: String,
    default: null
  },
  ai_profile_summary: {
    type: String,
    default: null
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Địa chỉ ví không hợp lệ']
  },
  wallet_verified: {
    type: Boolean,
    required: true,
    default: false
  },
  baseSalary: {
    type: Number,
    default: null
  },
  kpiBonus: {
    type: Number,
    default: null
  },
  allowance: {
    type: Number,
    default: null
  },
  taxRate: {
    type: Number,
    default: null
  },
  overtimeRate: {
    type: Number,
    default: null
  },
  salaryUpdatedAt: {
    type: Date,
    default: null
  },
  role_id: {
    type: String,
    required: false, // Optional for now, will be set during employee creation
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã vai trò (role_id) không hợp lệ.']
  }
}, {
  timestamps: true // Use mongoose's built-in timestamps for createdAt and updatedAt
});

// Indexes are automatically created for unique fields

const HoSoNhanVien = mongoose.model('HoSoNhanVien', HoSoNhanVienSchema, 'ho_so_nhan_vien');

module.exports = HoSoNhanVien;
