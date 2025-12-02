const mongoose = require('mongoose');

const RolesPermissionsSchema = new mongoose.Schema({
  role_id: {
    type: String,
    required: [true, 'Mã vai trò là bắt buộc'],
    unique: true,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã vai trò (role_id) không hợp lệ.']
  },
  ten_vai_tro: {
    type: String,
    required: true,
    enum: ["Super Admin", "Manager", "Employee"]
  },
  mo_ta: {
    type: String,
    default: null,
    maxLength: 500
  },
  permissions: {
    type: Object,
    required: true,
    default: {
      ho_so_nhan_vien: {
        view: false,
        create: false,
        update: false,
        delete: false,
        view_all: false
      },
      cham_cong: {
        view: false,
        create: false,
        update: false,
        approve: false
      },
      danh_gia_kpi: {
        view: false,
        create: false,
        update: false,
        approve: false
      },
      cong_viec_giao: {
        view: false,
        create: false,
        assign: false,
        update: false,
        delete: false
      },
      luong_thuong: {
        view: false,
        create: false,
        approve: false
      },
      phan_hoi_khach_hang: {
        view: false,
        manage: false
      },
      bao_cao: {
        view_department: false,
        view_company: false,
        export: false
      },
      system_settings: {
        manage_roles: false,
        manage_integrations: false,
        view_audit_logs: false
      }
    }
  },
  cap_do_uu_tien: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  trang_thai: {
    type: String,
    required: true,
    enum: ["Hoạt động", "Tạm khóa"],
    default: "Hoạt động"
  }
}, {
  timestamps: true
});

// Note: role_id already has unique index via unique: true
RolesPermissionsSchema.index({ ten_vai_tro: 1 });

const RolesPermissions = mongoose.model('RolesPermissions', RolesPermissionsSchema, 'roles_permissions');

module.exports = RolesPermissions;
