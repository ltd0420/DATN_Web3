const mongoose = require('mongoose');

const smartContractLogsSchema = new mongoose.Schema({
  contract_address: {
    type: String,
    required: true,
    match: /^0x[0-9a-fA-F]{40}$/
  },
  transaction_hash: {
    type: String,
    required: true,
    unique: true,
    match: /^0x[0-9a-fA-F]{64}$/
  },
  block_number: {
    type: Number,
    min: 0,
    default: null
  },
  function_name: {
    type: String,
    required: true
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  gas_used: {
    type: Number,
    min: 0,
    default: null
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Success",
      "Failed",
      "Pending"
    ]
  },
  employee_did: {
    type: String,
    match: [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Định dạng mã nhân viên (employee_did) không hợp lệ.'],
    default: null
  },
  amount: {
    type: Number,
    min: 0,
    default: null,
    description: "Số tiền thanh toán (USDT)"
  },
  event_logs: [{
    event_name: {
      type: String,
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  timestamp: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SmartContractLogs', smartContractLogsSchema, 'smart_contract_logs');
