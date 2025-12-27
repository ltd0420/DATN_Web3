const mongoose = require('mongoose');

const chamCongSchema = new mongoose.Schema({
  employee_did: {
    type: String,
    required: true
  },
  ngay: {
    type: Date,
    required: true
  },
  gio_vao: {
    type: String,
    default: null,
    match: /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/
  },
  gio_ra: {
    type: String,
    default: null,
    match: /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/
  },
  tong_gio_lam: {
    type: Number,
    min: 0,
    default: null
  },
  loai_ngay: {
    type: String,
    required: true,
    enum: [
      "Ngày thường",
      "Cuối tuần",
      "Lễ",
      "Nghỉ phép",
      "Nghỉ ốm",
      "Vắng không phép"
    ],
    default: "Ngày thường"
  },
  ghi_chu: {
    type: String,
    maxLength: 500,
    default: null
  },
  xac_thuc_qua: {
    type: String,
    required: true,
    enum: [
      "QR Code",
      "Fingerprint",
      "Face Recognition",
      "Manual",
      "Web App",
      "Mobile App"
    ]
  },
  transaction_hash: {
    type: String,
    default: null,
    description: "Transaction hash của bản ghi neo on-chain"
  },
  record_hash: {
    type: String,
    default: null,
    description: "Hash của bản ghi attendance để neo on-chain"
  },
  // Admin management fields
  trang_thai_phe_duyet: {
    type: String,
    enum: [
      "Chờ phê duyệt",
      "Đã phê duyệt",
      "Từ chối",
      "Không cần phê duyệt"
    ],
    default: "Không cần phê duyệt"
  },
  nguoi_phe_duyet_did: {
    type: String,
    default: null
  },
  ngay_phe_duyet: {
    type: Date,
    default: null
  },
  ly_do_phe_duyet: {
    type: String,
    maxLength: 1000,
    default: null
  },
  ghi_chu_admin: {
    type: String,
    maxLength: 1000,
    default: null
  },
  // Overtime management
  gio_lam_them: {
    type: Number,
    min: 0,
    default: 0
  },
  trang_thai_lam_them: {
    type: String,
    enum: [
      "Chờ phê duyệt",
      "Đã phê duyệt",
      "Từ chối",
      "Không áp dụng"
    ],
    default: "Không áp dụng"
  },
  nguoi_phe_duyet_lam_them_did: {
    type: String,
    default: null
  },
  ngay_phe_duyet_lam_them: {
    type: Date,
    default: null
  },
  ly_do_lam_them: {
    type: String,
    maxLength: 500,
    default: null
  },
  // Leave management
  loai_nghi_phep: {
    type: String,
    enum: [
      "Nghỉ phép năm",
      "Nghỉ ốm",
      "Nghỉ việc riêng",
      "Nghỉ thai sản",
      "Nghỉ không lương",
      null
    ],
    default: null
  },
  so_ngay_nghi: {
    type: Number,
    min: 0,
    default: 0
  },
  trang_thai_nghi_phep: {
    type: String,
    enum: [
      "Chờ phê duyệt",
      "Đã phê duyệt",
      "Từ chối",
      "Không áp dụng"
    ],
    default: "Không áp dụng"
  },
  nguoi_phe_duyet_nghi_did: {
    type: String,
    default: null
  },
  ngay_phe_duyet_nghi: {
    type: Date,
    default: null
  },
  ly_do_nghi: {
    type: String,
    maxLength: 500,
    default: null
  },
  // Missed checkout handling
  quen_checkout_bao_cao: {
    type: Boolean,
    default: false,
    description: "Nhân viên đã gửi biểu mẫu giải trình quên check-out hay chưa"
  },
  quen_checkout_mo_ta: {
    type: String,
    maxLength: 2000,
    default: null,
    description: "Nhân viên mô tả đã làm gì trong ngày khi quên check-out"
  },
  quen_checkout_bang_chung: [{
    type: String,
    description: "Danh sách URL/bằng chứng (ảnh, tài liệu) do nhân viên cung cấp"
  }],
  quen_checkout_trang_thai: {
    type: String,
    enum: [
      "Chờ phê duyệt",
      "Đã phê duyệt",
      "Từ chối",
      "Không áp dụng"
    ],
    default: "Không áp dụng"
  },
  quen_checkout_gio_xac_nhan: {
    type: Number,
    min: 0,
    default: null,
    description: "Số giờ làm việc mà nhân viên khai báo khi quên check-out"
  },
  // Manual entry tracking
  nhap_thu_cong: {
    type: Boolean,
    default: false
  },
  nguoi_nhap_did: {
    type: String,
    default: null
  },
  ngay_nhap: {
    type: Date,
    default: null
  },
  // Salary calculation fields
  luong_tinh_theo_gio: {
    type: Number,
    min: 0,
    default: 0,
    description: "Lương tính theo giờ (USDT): 1 giờ = 1 USDT"
  },
  trang_thai_cham_cong: {
    type: String,
    enum: [
      "Đã hoàn thành",
      "Tạm ngưng",
      "Chưa check-in"
    ],
    default: "Chưa check-in",
    description: "Trạng thái chấm công: Tạm ngưng khi quên checkout"
  },
  salary_transaction_hash: {
    type: String,
    default: null,
    description: "Transaction hash khi thanh toán lương qua smart contract"
  }
}, {
  timestamps: true
});

// Compound index for unique attendance per employee per day
chamCongSchema.index({ employee_did: 1, ngay: 1 }, { unique: true });

module.exports = mongoose.model('ChamCong', chamCongSchema, 'cham_cong');
