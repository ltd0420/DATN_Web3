const mongoose = require('mongoose');

const testSubmissionSchema = new mongoose.Schema({
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
  answers: [{
    question_id: {
      type: String,
      required: true
    },
    selected_answer_index: {
      type: Number,
      required: true
    }
  }],
  score: {
    type: Number,
    default: 0
  },
  max_score: {
    type: Number,
    default: 0
  },
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
  collection: 'test_submissions'
});

// Unique constraint: mỗi nhân viên chỉ làm test 1 lần cho 1 phòng ban
testSubmissionSchema.index({ employee_did: 1, department_id: 1 }, { unique: true });

module.exports = mongoose.model('TestSubmission', testSubmissionSchema);

