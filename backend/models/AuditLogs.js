const mongoose = require('mongoose');

const auditLogsSchema = new mongoose.Schema({
  user_did: {
    type: String,
    required: false,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã người dùng (user_did) không hợp lệ.']
  },
  action: {
    type: String,
    required: true
  },
  resource_type: {
    type: String,
    required: true
  },
  resource_id: {
    type: String,
    required: true
  },
  changes: {
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Success",
      "Failed",
      "Unauthorized"
    ]
  },
  error_message: {
    type: String,
    default: null
  },
  details: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    required: true
  }
}, {
  timestamps: false // We use timestamp field instead
});

module.exports = mongoose.model('AuditLogs', auditLogsSchema, 'audit_logs');
