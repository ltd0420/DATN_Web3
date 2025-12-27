const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  employee_did: {
    type: String,
    required: true,
    index: true
  },
  department_id: {
    type: String,
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  max_score: {
    type: Number,
    default: 100
  },
  // Simplified: chỉ lưu điểm, không cần câu hỏi chi tiết cho demo
  submitted_at: {
    type: Date,
    default: Date.now
  },
  // Blockchain info (optional)
  transaction_hash: {
    type: String,
    default: null
  },
  block_number: {
    type: Number,
    default: null
  }
}, {
  timestamps: true,
  collection: 'test_results'
});

// Unique constraint: mỗi nhân viên chỉ làm test 1 lần cho 1 phòng ban
testResultSchema.index({ employee_did: 1, department_id: 1 }, { unique: true });

module.exports = mongoose.model('TestResult', testResultSchema);

