const mongoose = require('mongoose');
const RolesPermissions = require('../models/RolesPermissions');
require('dotenv').config();

const defaultRoles = [
  {
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a', // Super Admin
    ten_vai_tro: 'Super Admin',
    mo_ta: 'Quyền truy cập đầy đủ hệ thống, quản lý vai trò và cài đặt',
    cap_do_uu_tien: 100,
    trang_thai: 'Hoạt động',
    permissions: {
      ho_so_nhan_vien: {
        view: true,
        create: true,
        update: true,
        delete: true,
        view_all: true
      },
      cham_cong: {
        view: true,
        create: true,
        update: true,
        approve: true
      },
      danh_gia_kpi: {
        view: true,
        create: true,
        update: true,
        approve: true
      },
      cong_viec_giao: {
        view: true,
        create: true,
        assign: true,
        update: true,
        delete: true
      },
      luong_thuong: {
        view: true,
        create: true,
        approve: true
      },
      phan_hoi_khach_hang: {
        view: true,
        manage: true
      },
      bao_cao: {
        view_department: true,
        view_company: true,
        export: true
      },
      system_settings: {
        manage_roles: true,
        manage_integrations: true,
        view_audit_logs: true
      }
    }
  },
  {
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b', // Manager
    ten_vai_tro: 'Manager',
    mo_ta: 'Quản lý phòng ban, nhân viên và phê duyệt các yêu cầu',
    cap_do_uu_tien: 50,
    trang_thai: 'Hoạt động',
    permissions: {
      ho_so_nhan_vien: {
        view: true,
        create: true,
        update: true,
        delete: false,
        view_all: true
      },
      cham_cong: {
        view: true,
        create: true,
        update: true,
        approve: true
      },
      danh_gia_kpi: {
        view: true,
        create: true,
        update: true,
        approve: true
      },
      cong_viec_giao: {
        view: true,
        create: true,
        assign: true,
        update: true,
        delete: false
      },
      luong_thuong: {
        view: true,
        create: true,
        approve: true
      },
      phan_hoi_khach_hang: {
        view: true,
        manage: false
      },
      bao_cao: {
        view_department: true,
        view_company: false,
        export: true
      },
      system_settings: {
        manage_roles: false,
        manage_integrations: false,
        view_audit_logs: false
      }
    }
  },
  {
    role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c', // Employee
    ten_vai_tro: 'Employee',
    mo_ta: 'Nhân viên cơ bản với quyền truy cập hạn chế',
    cap_do_uu_tien: 10,
    trang_thai: 'Hoạt động',
    permissions: {
      ho_so_nhan_vien: {
        view: true,
        create: false,
        update: false,
        delete: false,
        view_all: false
      },
      cham_cong: {
        view: true,
        create: true,
        update: false,
        approve: false
      },
      danh_gia_kpi: {
        view: true,
        create: false,
        update: false,
        approve: false
      },
      cong_viec_giao: {
        view: true,
        create: false,
        assign: false,
        update: false,
        delete: false
      },
      luong_thuong: {
        view: true,
        create: false,
        approve: false
      },
      phan_hoi_khach_hang: {
        view: false,
        manage: false
      },
      bao_cao: {
        view_department: false,
        view_company: false,
        export: false
      },
      system_settings: {
        manage_roles: false,
        manage_integrations: false,
        view_audit_logs: false
      }
    }
  }
];

async function seedRoles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://nguyenhuy4435:nhathuy812@clusterweb3.5tqfgfq.mongodb.net/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    console.log('Database name:', mongoose.connection.db.databaseName);

    // Clear existing roles
    await RolesPermissions.deleteMany({});
    console.log('Cleared existing roles');

    // Insert default roles
    const insertedRoles = await RolesPermissions.insertMany(defaultRoles);
    console.log(`Seeded ${insertedRoles.length} roles successfully`);

    // Display inserted roles
    console.log('\nInserted Roles:');
    insertedRoles.forEach(role => {
      console.log(`- ${role.ten_vai_tro} (${role.role_id})`);
    });

    console.log('\nSeeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
}

// Run the seeder
seedRoles();
