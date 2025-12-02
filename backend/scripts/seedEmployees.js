const mongoose = require('mongoose');
const HoSoNhanVien = require('../models/HoSoNhanVien');
require('dotenv').config();

// 3 roles only: Super Admin, Manager, Employee
const defaultEmployees = [
  {
    employee_did: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7a', // Super Admin (UUID v4)
    ho_ten: 'Super Admin',
    email: 'superadmin@company.com',
    so_dien_thoai: '0123456789',
    ngay_sinh: new Date('1990-01-01'),
    dia_chi: '123 Admin Street',
    chuc_vu: 'CEO',
    phong_ban_id: null,
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a', // Super Admin role
    trang_thai: 'Đang làm việc',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    wallet_verified: true
  },
  {
    employee_did: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7b', // Manager (UUID v4)
    ho_ten: 'Manager User',
    email: 'manager@company.com',
    so_dien_thoai: '0123456788',
    ngay_sinh: new Date('1985-05-15'),
    dia_chi: '456 Manager Avenue',
    chuc_vu: 'Manager',
    phong_ban_id: null,
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b', // Manager role
    trang_thai: 'Đang làm việc',
    walletAddress: '0x1234567890123456789012345678901234567890',
    wallet_verified: true
  },
  {
    employee_did: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7c', // Employee (UUID v4)
    ho_ten: 'Regular Employee',
    email: 'employee@company.com',
    so_dien_thoai: '0123456786',
    ngay_sinh: new Date('1995-03-10'),
    dia_chi: '321 Employee Lane',
    chuc_vu: 'Junior Developer',
    phong_ban_id: '3d868e1f-2f53-4819-8ef6-b4af62fbb7b2',
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c', // Employee role
    trang_thai: 'Đang làm việc',
    walletAddress: '0x1111111111111111111111111111111111111111',
    wallet_verified: true
  },
  {
    employee_did: '397b1eb8-24fc-42dc-a87b-e4e3a6303f7a', // Another Employee (UUID v4)
    ho_ten: 'Nguyễn Văn A',
    email: 'nguyenvana@company.com',
    so_dien_thoai: '0987654321',
    ngay_sinh: new Date('1992-07-25'),
    dia_chi: '456 Business District',
    chuc_vu: 'Sales Executive',
    phong_ban_id: '3d868e1f-2f53-4819-8ef6-b4af62fbb7b2',
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c', // Employee role
    trang_thai: 'Đang làm việc',
    walletAddress: '0x2222222222222222222222222222222222222222',
    wallet_verified: true
  }
];

async function seedEmployees() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://nguyenhuy4435:nhathuy812@clusterweb3.5tqfgfq.mongodb.net/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    console.log('Database name:', mongoose.connection.db.databaseName);

    // Clear existing employees
    await HoSoNhanVien.deleteMany({});
    console.log('Cleared existing employees');

    // Insert default employees
    const insertedEmployees = await HoSoNhanVien.insertMany(defaultEmployees);
    console.log(`Seeded ${insertedEmployees.length} employees successfully`);

    // Display inserted employees
    console.log('\nInserted Employees:');
    insertedEmployees.forEach(emp => {
      console.log(`- ${emp.ho_ten} (${emp.employee_did}) - ${emp.email}`);
    });

    console.log('\nSeeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding employees:', error);
    process.exit(1);
  }
}

// Run the seeder
seedEmployees();
