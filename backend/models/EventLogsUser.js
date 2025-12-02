const mongoose = require('mongoose');

const eventLogsUserSchema = new mongoose.Schema({
  user_did: {
    type: String,
    required: false,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã người dùng (user_did) không hợp lệ.']
  },
  event_type: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  resource_type: {
    type: String,
    default: null
  },
  resource_id: {
    type: String,
    default: null
  },
  is_read: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    required: true
  }
}, {
  timestamps: false // We use timestamp field instead
});

module.exports = mongoose.model('EventLogsUser', eventLogsUserSchema, 'event_logs_user');
