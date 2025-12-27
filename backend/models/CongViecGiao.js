const mongoose = require('mongoose');

const CongViecGiaoSchema = new mongoose.Schema({
  task_id: {
    type: String,
    required: [true, 'Mã công việc là bắt buộc'],
    unique: true,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã công việc (task_id) không hợp lệ.']
  },
  ten_cong_viec: {
    type: String,
    required: [true, 'Tên công việc là bắt buộc'],
    maxLength: [200, 'Tên công việc không được vượt quá 200 ký tự']
  },
  mo_ta: {
    type: String,
    maxLength: [5000, 'Mô tả không được vượt quá 5000 ký tự']
  },
  nguoi_giao_did: {
    type: String,
    required: [true, 'Người giao việc là bắt buộc'],
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã người giao (nguoi_giao_did) không hợp lệ.']
  },
  nguoi_thuc_hien_did: {
    type: String,
    // Cho phép tạo công việc cho cả phòng ban mà chưa gán sẵn 1 nhân viên
    required: false,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã người thực hiện (nguoi_thuc_hien_did) không hợp lệ.']
  },
  phong_ban_id: {
    type: String,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã phòng ban (phong_ban_id) không hợp lệ.']
  },
  // Cờ đánh dấu công việc này là "giao cho cả phòng ban, ai nhận trước thì làm"
  is_department_task: {
    type: Boolean,
    default: false
  },
  do_uu_tien: {
    type: String,
    required: true,
    enum: ["Thấp", "Trung bình", "Cao", "Khẩn cấp"],
    default: "Trung bình"
  },
  muc_do_kho: {
    type: String,
    required: true,
    enum: ["Dễ", "Vừa", "Khó"],
    default: "Vừa"
  },
  tien_thuong: {
    type: Number,
    min: 0,
    default: 0,
    description: "Số tiền thưởng (USDT) khi hoàn thành đúng hạn"
  },
  tien_phat: {
    type: Number,
    min: 0,
    default: 0,
    description: "Số tiền phạt (USDT) khi không hoàn thành đúng hạn hoặc không làm được"
  },
  payment_transaction_hash: {
    type: String,
    default: null,
    description: "Transaction hash khi chuyển tiền thưởng qua smart contract"
  },
  payment_block_number: {
    type: Number,
    default: null,
    description: "Block number của transaction chuyển tiền"
  },
  payment_timestamp: {
    type: Date,
    default: null,
    description: "Thời gian chuyển tiền thành công"
  },
  payment_status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: null,
    description: "Trạng thái thanh toán: pending (chờ), completed (thành công), failed (thất bại)"
  },
  payment_error: {
    type: String,
    default: null,
    description: "Thông báo lỗi nếu thanh toán thất bại"
  },
  potential_reward: {
    type: Number,
    min: 0,
    default: null,
    description: "Số tiền thưởng tiềm năng nếu hoàn thành đúng hạn (hiển thị khi tạo task)"
  },
  potential_penalty: {
    type: Number,
    min: 0,
    default: null,
    description: "Số tiền phạt tiềm năng nếu quá hạn (hiển thị khi tạo task)"
  },
  trang_thai: {
    type: String,
    required: true,
    enum: [
      "Chờ bắt đầu",
      "Đang thực hiện",
      "Tạm dừng",
      "Chờ review",
      "Hoàn thành",
      "Hủy bỏ"
    ],
    default: "Chờ bắt đầu"
  },
  da_dong_y: {
    type: Boolean,
    default: false,
    description: "Nhân viên đã đồng ý nhận công việc chưa"
  },
  ngay_dong_y: {
    type: Date,
    default: null,
    description: "Thời gian nhân viên đồng ý nhận công việc"
  },
  ngay_bat_dau: {
    type: Date,
    required: true
  },
  ngay_ket_thuc_du_kien: {
    type: Date,
    required: true
  },
  ngay_hoan_thanh_thuc_te: {
    type: Date
  },
  tien_do: {
    type: Number,
    required: true,
    min: [0, 'Tiến độ không được nhỏ hơn 0'],
    max: [100, 'Tiến độ không được lớn hơn 100'],
    default: 0
  },
  tien_do_milestones: {
    type: [{
      milestone: {
        type: Number,
        required: true,
        enum: [25, 50, 75, 100],
        description: "Mốc tiến độ: 25%, 50%, 75%, 100%"
      },
      status: {
        type: String,
        required: true,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        description: "Trạng thái: pending (chờ phê duyệt), approved (đã phê duyệt), rejected (từ chối)"
      },
      submitted_at: {
        type: Date,
        default: Date.now,
        description: "Thời gian nhân viên submit mốc tiến độ này"
      },
      approved_at: {
        type: Date,
        default: null,
        description: "Thời gian admin phê duyệt mốc tiến độ này"
      },
      approved_by: {
        type: String,
        default: null,
        description: "Employee DID của admin phê duyệt"
      },
      note: {
        type: String,
        default: null,
        description: "Ghi chú của nhân viên khi submit mốc tiến độ"
      },
      admin_note: {
        type: String,
        default: null,
        description: "Ghi chú của admin khi phê duyệt/từ chối"
      }
    }],
    default: [],
    description: "Lịch sử các mốc tiến độ và trạng thái phê duyệt"
  },
  current_pending_milestone: {
    type: Number,
    default: null,
    enum: [25, 50, 75, 100, null],
    description: "Mốc tiến độ hiện tại đang chờ phê duyệt (null nếu không có)"
  },
  gio_uoc_tinh: {
    type: Number,
    min: [0, 'Giờ ước tính không được âm']
  },
  gio_thuc_te: {
    type: Number,
    min: [0, 'Giờ thực tế không được âm']
  },
  tags: [{
    type: String
  }],
  lien_ket_kpi_id: {
    type: String,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã KPI (lien_ket_kpi_id) không hợp lệ.']
  },
  task_cha_id: {
    type: String,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã task cha (task_cha_id) không hợp lệ.']
  },
  subtasks: [{
    type: String,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng UUID không hợp lệ trong subtasks.']
  }],
  file_dinh_kem: [{
    file_name: {
      type: String,
      required: true
    },
    file_uri: {
      type: String,
      required: true
    },
    file_type: {
      type: String,
      required: true
    },
    file_size: {
      type: Number,
      default: 0,
      description: "File size in bytes"
    },
    uploaded_at: {
      type: Date,
      required: true,
      default: Date.now
    },
    uploaded_by: {
      type: String,
      description: "Employee DID who uploaded the file"
    }
  }],
  nhan_xet: [{
    nguoi_nhan_xet_did: {
      type: String,
      required: true,
      match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã người nhận xét không hợp lệ.']
    },
    noi_dung: {
      type: String,
      required: true,
      maxLength: [2000, 'Nội dung nhận xét không được vượt quá 2000 ký tự']
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  }],
  ai_insights: {
    risk_level: {
      type: String,
      enum: ["Thấp", "Trung bình", "Cao"]
    },
    predicted_completion_date: {
      type: Date
    },
    workload_score: {
      type: Number,
      min: 0,
      max: 100
    },
    recommendations: [{
      type: String
    }]
  }
}, {
  timestamps: true
});

// Indexes are automatically created for unique fields
// Additional index for nguoi_thuc_hien_did for faster queries
CongViecGiaoSchema.index({ nguoi_thuc_hien_did: 1 });
CongViecGiaoSchema.index({ nguoi_giao_did: 1 });
CongViecGiaoSchema.index({ trang_thai: 1 });
CongViecGiaoSchema.index({ do_uu_tien: 1 });
CongViecGiaoSchema.index({ ngay_ket_thuc_du_kien: 1 });

const CongViecGiao = mongoose.model('CongViecGiao', CongViecGiaoSchema, 'cong_viec_giao');

module.exports = CongViecGiao;
