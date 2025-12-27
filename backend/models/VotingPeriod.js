const mongoose = require('mongoose');

const votingPeriodSchema = new mongoose.Schema({
  department_id: {
    type: String,
    required: true,
    index: true
  },
  period_id: {
    type: Number,
    required: true
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_ended: {
    type: Boolean,
    default: false
  },
  // Winner info (sau khi kết thúc)
  winner_did: {
    type: String,
    default: null
  },
  winner_votes: {
    type: Number,
    default: 0
  },
  winner_wallet: {
    type: String,
    default: null
  },
  // Blockchain info (optional)
  contract_address: {
    type: String,
    default: null
  },
  transaction_hash: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'voting_periods'
});

// Unique constraint: mỗi department chỉ có 1 period active tại 1 thời điểm
votingPeriodSchema.index({ department_id: 1, period_id: 1 }, { unique: true });
votingPeriodSchema.index({ department_id: 1, is_active: 1 });

module.exports = mongoose.model('VotingPeriod', votingPeriodSchema);

