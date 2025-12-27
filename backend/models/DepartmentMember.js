const mongoose = require('mongoose');

const departmentMemberSchema = new mongoose.Schema({
  department_id: {
    type: String,
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
  qualification_method: {
    type: String,
    enum: ['test', 'voting'],
    required: true
  },
  // Test qualification info
  test_score: {
    type: Number,
    default: null
  },
  // Voting qualification info
  voting_period_id: {
    type: Number,
    default: null
  },
  votes_received: {
    type: Number,
    default: null
  },
  // Reward info
  tusd_reward_received: {
    type: Number,
    default: 0
  },
  reward_transaction_hash: {
    type: String,
    default: null
  },
  // Blockchain info
  blockchain_tx_hash: {
    type: String,
    default: null
  },
  blockchain_block_number: {
    type: Number,
    default: null
  },
  // Status
  is_active: {
    type: Boolean,
    default: true
  },
  joined_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'department_members'
});

// Compound index để check membership nhanh
departmentMemberSchema.index({ department_id: 1, employee_did: 1 });
departmentMemberSchema.index({ employee_did: 1, is_active: 1 });

module.exports = mongoose.model('DepartmentMember', departmentMemberSchema);

