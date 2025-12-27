const mongoose = require('mongoose');

const danhMucPhongBanSchema = new mongoose.Schema({
  phong_ban_id: {
    type: String,
    required: true,
    unique: true,
    match: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  },
  ten_phong_ban: {
    type: String,
    required: true
  },
  mo_ta: {
    type: String,
    default: null
  },
  truong_phong_did: {
    type: String,
    default: null,
    match: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DanhMucPhongBan', danhMucPhongBanSchema, 'danh_muc_phong_ban');
