const mongoose = require('mongoose');
const HoSoNhanVien = require('../models/HoSoNhanVien');
require('dotenv').config();

const superAdminData = {
  employee_did: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7a', // Use valid UUID v4 format
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Valid Ethereum address
  wallet_verified: true,
  chuc_vu: 'CEO', // Use valid enum value
  phong_ban_id: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7a', // Default department
  role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a', // Super Admin role
  trang_thai: 'Đang làm việc',
  ngay_vao_lam: new Date().toISOString().split('T')[0],
  createdAt: new Date(),
  updatedAt: new Date()
};

async function seedSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://nguyenhuy4435:nhathuy812@clusterweb3.5tqfgfq.mongodb.net/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if Super Admin already exists
    const existingAdmin = await HoSoNhanVien.findOne({ employee_did: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7a' });
    if (existingAdmin) {
      console.log('Super Admin already exists');
      process.exit(0);
    }

    // Create Super Admin
    const superAdmin = new HoSoNhanVien(superAdminData);
    await superAdmin.save();

    console.log('Super Admin seeded successfully');
    console.log('Employee DID: 01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7a');
    console.log('Wallet Address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
