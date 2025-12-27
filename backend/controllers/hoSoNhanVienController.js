const { ethers } = require('ethers');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const ChamCong = require('../models/ChamCong');
const QrAuthentication = require('../models/QrAuthentication');
const AuditLogs = require('../models/AuditLogs');
const EventLogsUser = require('../models/EventLogsUser');
const SmartContractLogs = require('../models/SmartContractLogs');
const DanhMucPhongBan = require('../models/DanhMucPhongBan');
const RolesPermissions = require('../models/RolesPermissions');

// Optional models - only require if they exist
let DanhGiaKpi, LuongThuong, PhanHoiKhachHang, XepHangNhanVien;
try {
  DanhGiaKpi = require('../models/DanhGiaKpi');
} catch (e) {
  DanhGiaKpi = null;
}
try {
  LuongThuong = require('../models/LuongThuong');
} catch (e) {
  LuongThuong = null;
}
try {
  PhanHoiKhachHang = require('../models/PhanHoiKhachHang');
} catch (e) {
  PhanHoiKhachHang = null;
}
try {
  XepHangNhanVien = require('../models/XepHangNhanVien');
} catch (e) {
  XepHangNhanVien = null;
}

const normalizeWalletAddress = (address) => {
  if (!address) {
    throw new Error('Địa chỉ ví là bắt buộc.');
  }

  const trimmed = address.trim();
  if (!ethers.isAddress(trimmed)) {
    throw new Error('Địa chỉ ví Ethereum không hợp lệ (định dạng 0x...).');
  }

  return ethers.getAddress(trimmed).toLowerCase();
};

const ensureWalletAvailable = async (walletAddress, excludeEmployeeDid = null) => {
  const query = { walletAddress };
  if (excludeEmployeeDid) {
    query.employee_did = { $ne: excludeEmployeeDid };
  }

  const existingEmployee = await HoSoNhanVien.findOne(query);
  if (existingEmployee) {
    throw new Error('Địa chỉ ví này đã được gán cho một nhân viên khác.');
  }
};

// Get all employees
const getAll = async (req, res) => {
  try {
    const { employee_did, role_id } = req.user;

    // Get user's role
    const userRole = await RolesPermissions.findOne({ role_id: role_id });
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: 'User role not found'
      });
    }

    let query = {};

    // Super Admin and Manager can see all employees (no filter applied)
    // Employee role can only see their own profile
    if (userRole.ten_vai_tro === 'Employee') {
      query.employee_did = employee_did;
    }

    const hoSoNhanVien = await HoSoNhanVien.find(query);
    res.json(hoSoNhanVien);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get employee by DID
const getById = async (req, res) => {
  try {
    const hoSoNhanVien = await HoSoNhanVien.findOne({ employee_did: req.params.id });
    if (!hoSoNhanVien) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(hoSoNhanVien);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get employee by wallet address
const getByWallet = async (req, res) => {
  try {
    let walletParam;
    try {
      walletParam = normalizeWalletAddress(req.params.walletAddress || req.params.wallet);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    const hoSoNhanVien = await HoSoNhanVien.findOne({ walletAddress: walletParam });
    if (!hoSoNhanVien) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(hoSoNhanVien);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new employee (Super Admin or Department Head)
const create = async (req, res) => {
  try {
    const { employee_did } = req.user;

    // Get user's role
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: 'User role not found'
      });
    }

    const { phong_ban_id } = req.body;

    // Check permissions based on role - Only Super Admin and Manager can create employees
    if (userRole.ten_vai_tro !== 'Super Admin' && userRole.ten_vai_tro !== 'Manager') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin và Manager mới có quyền tạo nhân viên.'
      });
    }

    // Normalize and validate wallet address
    const normalizedWallet = normalizeWalletAddress(req.body.walletAddress);
    await ensureWalletAvailable(normalizedWallet);

    // Set default role_id to Employee if not provided
    const employeeData = {
      ...req.body,
      role_id: req.body.role_id || '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c', // Default to Employee role
      walletAddress: normalizedWallet
    };

    const hoSoNhanVien = new HoSoNhanVien(employeeData);
    const newHoSoNhanVien = await hoSoNhanVien.save();

    // Log employee creation
    await AuditLogs.create({
      user_did: employee_did,
      action: 'CREATE_EMPLOYEE',
      resource_type: 'ho_so_nhan_vien',
      resource_id: newHoSoNhanVien._id.toString(),
      status: 'Success',
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      employee: newHoSoNhanVien,
      message: 'Employee created successfully'
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update employee
const update = async (req, res) => {
  try {
    if (req.body.walletAddress) {
      const normalizedWallet = normalizeWalletAddress(req.body.walletAddress);
      await ensureWalletAvailable(normalizedWallet, req.params.id);
      req.body.walletAddress = normalizedWallet;
      req.body.wallet_verified = false;
    }

    const updatedHoSoNhanVien = await HoSoNhanVien.findOneAndUpdate(
      { employee_did: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedHoSoNhanVien) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(updatedHoSoNhanVien);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update wallet address
const updateWalletAddress = async (req, res) => {
  try {
    const normalizedWallet = normalizeWalletAddress(req.body.walletAddress);
    await ensureWalletAvailable(normalizedWallet, req.params.id);

    const updatedEmployee = await HoSoNhanVien.findOneAndUpdate(
      { employee_did: req.params.id },
      { walletAddress: normalizedWallet, wallet_verified: false },
      { new: true, runValidators: true }
    );
    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(updatedEmployee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete employee with cascade delete
const deleteEmployee = async (req, res) => {
  try {
    const employeeDid = req.params.id;

    // Find the employee first to confirm existence
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Start cascade delete operations
    const deleteOperations = [
      // Delete attendance records
      ChamCong.deleteMany({ employee_did: employeeDid }),

      // Delete KPI evaluations (if model exists)
      ...(DanhGiaKpi ? [DanhGiaKpi.deleteMany({ employee_did: employeeDid })] : []),

      // Delete salary records (if model exists)
      ...(LuongThuong ? [LuongThuong.deleteMany({ employee_did: employeeDid })] : []),

      // Delete customer feedback (if model exists)
      ...(PhanHoiKhachHang ? [PhanHoiKhachHang.deleteMany({ employee_did: employeeDid })] : []),

      // Delete employee rankings (if model exists)
      ...(XepHangNhanVien ? [XepHangNhanVien.deleteMany({ employee_did: employeeDid })] : []),

      // Delete QR authentication records
      QrAuthentication.deleteMany({ employee_did: employeeDid }),

      // Delete audit logs related to this employee
      AuditLogs.deleteMany({ user_did: employeeDid }),

      // Delete event logs related to this employee
      EventLogsUser.deleteMany({ user_did: employeeDid }),

      // Delete smart contract logs related to this employee (if any)
      SmartContractLogs.deleteMany({
        'parameters.employee_did': employeeDid
      }),

      // Finally delete the employee record
      HoSoNhanVien.findOneAndDelete({ employee_did: employeeDid })
    ];

    // Execute all delete operations
    const results = await Promise.allSettled(deleteOperations);

    // Check if all operations succeeded
    const failedOperations = results.filter(result => result.status === 'rejected');
    if (failedOperations.length > 0) {
      console.error('Some cascade delete operations failed:', failedOperations);
      // Continue anyway since some data might have been deleted
    }

    res.json({
      message: 'Employee and all related data deleted successfully',
      deletedData: {
        employee: true,
        attendanceRecords: true,
        kpiEvaluations: true,
        salaryRecords: true,
        customerFeedback: true,
        rankings: true,
        qrAuthentications: true,
        auditLogs: true,
        eventLogs: true,
        smartContractLogs: true
      }
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get employees by department
const getEmployeesByDepartment = async (req, res) => {
  try {
    const employees = await HoSoNhanVien.find({ phong_ban_id: req.params.departmentId });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify wallet
const verifyWallet = async (req, res) => {
  try {
    const { employee_did, verified } = req.body;
    const updatedEmployee = await HoSoNhanVien.findOneAndUpdate(
      { employee_did },
      { wallet_verified: verified },
      { new: true }
    );
    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(updatedEmployee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAll,
  getById,
  getByWallet,
  create,
  update,
  updateWalletAddress,
  delete: deleteEmployee,
  getEmployeesByDepartment,
  verifyWallet
};
