const mongoose = require('mongoose');

const votingVoteSchema = new mongoose.Schema({
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
  voter_address: {
    type: String,
    required: true,
    index: true
  },
  candidate_did: {
    type: String,
    required: true
  },
  voted_at: {
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
  collection: 'voting_votes'
});

// Unique constraint: mỗi người chỉ vote 1 lần trong 1 period
votingVoteSchema.index({ department_id: 1, period_id: 1, voter_address: 1 }, { unique: true });
votingVoteSchema.index({ department_id: 1, period_id: 1, candidate_did: 1 });

module.exports = mongoose.model('VotingVote', votingVoteSchema);

