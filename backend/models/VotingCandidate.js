const mongoose = require('mongoose');

const votingCandidateSchema = new mongoose.Schema({
  department_id: {
    type: String,
    required: true,
    index: true
  },
  period_id: {
    type: Number,
    required: true,
    index: true
  },
  employee_did: {
    type: String,
    required: true,
    index: true
  },
  wallet_address: {
    type: String,
    required: true
  },
  votes: {
    type: Number,
    default: 0
  },
  registered_at: {
    type: Date,
    default: Date.now
  },
  // Blockchain info (optional)
  transaction_hash: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'voting_candidates'
});

// Unique constraint: mỗi nhân viên chỉ đăng ký 1 lần trong 1 period
votingCandidateSchema.index({ department_id: 1, period_id: 1, employee_did: 1 }, { unique: true });
votingCandidateSchema.index({ department_id: 1, period_id: 1, votes: -1 }); // For sorting by votes

module.exports = mongoose.model('VotingCandidate', votingCandidateSchema);

