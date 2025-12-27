const mongoose = require('mongoose');

const qrAuthenticationSchema = new mongoose.Schema({
  qr_code_id: {
    type: String,
    required: true,
    unique: true
  },
  employee_did: {
    type: String,
    required: true
  },
  qr_hash: {
    type: String,
    required: true
  },
  trang_thai: {
    type: String,
    required: true,
    enum: [
      "Hoạt động",
      "Tạm khóa",
      "Đã thu hồi"
    ],
    default: "Hoạt động"
  },
  ngay_cap: {
    type: Date,
    required: true
  },
  ngay_het_han: {
    type: Date,
    default: null
  },
  so_lan_su_dung: {
    type: Number,
    min: 0,
    default: 0
  },
  lan_su_dung_cuoi: {
    type: Date,
    default: null
  },
  qr_image: {
    type: String,
    default: null
  },
  so_lan_tao_qr: {
    type: Number,
    min: 0,
    default: 0
  },
  lan_tao_qr_cuoi: {
    type: Date,
    default: null
  },
  // Web3/Blockchain fields
  token_id: {
    type: String,
    default: null,
    description: "ERC-721 Token ID on blockchain"
  },
  transaction_hash: {
    type: String,
    default: null,
    description: "Transaction hash của việc mint NFT"
  },
  wallet_address: {
    type: String,
    pattern: "^0x[a-fA-F0-9]{40}$",
    description: "Địa chỉ ví sở hữu NFT"
  },
  blockchain_signature: {
    type: String,
    default: null,
    description: "Chữ ký số của QR data từ wallet"
  },
  contract_address: {
    type: String,
    pattern: "^0x[a-fA-F0-9]{40}$",
    default: null,
    description: "Địa chỉ smart contract"
  },
  network: {
    type: String,
    enum: ["ethereum", "polygon", "bsc", "localhost"],
    default: "ethereum",
    description: "Blockchain network"
  }
}, {
  timestamps: true
});

// Index for blockchain queries
qrAuthenticationSchema.index({ token_id: 1 });
qrAuthenticationSchema.index({ transaction_hash: 1 });
qrAuthenticationSchema.index({ wallet_address: 1 });
qrAuthenticationSchema.index({ contract_address: 1 });

module.exports = mongoose.model('QrAuthentication', qrAuthenticationSchema, 'qr_authentication');
