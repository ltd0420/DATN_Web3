const mongoose = require('mongoose');

const departmentWeb3Schema = new mongoose.Schema({
  department_id: {
    type: String,
    required: true,
    unique: true
  },
  phong_ban_id: {
    type: String,
    default: null,
    unique: true,
    sparse: true, // Allow multiple null values
    match: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  },
  department_name: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  // Test configuration
  require_test: {
    type: Boolean,
    default: false
  },
  test_contract_address: {
    type: String,
    default: null
  },
  min_test_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Blockchain info
  contract_address: {
    type: String,
    default: null
  },
  network: {
    type: String,
    default: 'localhost'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'department_web3'
});

// Indexes
departmentWeb3Schema.index({ department_id: 1 });
departmentWeb3Schema.index({ phong_ban_id: 1 });
departmentWeb3Schema.index({ is_active: 1 });

module.exports = mongoose.model('DepartmentWeb3', departmentWeb3Schema);

