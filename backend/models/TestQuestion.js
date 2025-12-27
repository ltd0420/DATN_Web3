const mongoose = require('mongoose');

const testQuestionSchema = new mongoose.Schema({
  department_id: {
    type: String,
    required: true,
    index: true
  },
  question_id: {
    type: String,
    required: true
  },
  question_text: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length >= 2;
      },
      message: 'Must have at least 2 options'
    }
  },
  correct_answer_index: {
    type: Number,
    required: true,
    min: 0
  },
  points: {
    type: Number,
    required: true,
    min: 1,
    default: 10
  },
  order: {
    type: Number,
    default: 0
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'test_questions'
});

// Unique constraint: mỗi câu hỏi chỉ có 1 lần trong 1 phòng ban
testQuestionSchema.index({ department_id: 1, question_id: 1 }, { unique: true });
testQuestionSchema.index({ department_id: 1, order: 1 });

module.exports = mongoose.model('TestQuestion', testQuestionSchema);

