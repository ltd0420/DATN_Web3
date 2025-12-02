const DanhMucPhongBan = require('../models/DanhMucPhongBan');
const { v4: uuidv4 } = require('uuid');

// Get all departments
const getAll = async (req, res) => {
  try {
    const danhMucPhongBan = await DanhMucPhongBan.find();
    res.json(danhMucPhongBan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get department by ID
const getById = async (req, res) => {
  try {
    const danhMucPhongBan = await DanhMucPhongBan.findOne({ phong_ban_id: req.params.id });
    if (!danhMucPhongBan) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json(danhMucPhongBan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new department
const create = async (req, res) => {
  try {
    // Generate UUID for phong_ban_id if not provided
    const departmentData = {
      ...req.body,
      phong_ban_id: req.body.phong_ban_id || uuidv4()
    };

    // If truong_phong_did is provided, update the employee's role_id to Manager
    if (departmentData.truong_phong_did) {
      const HoSoNhanVien = require('../models/HoSoNhanVien');
      await HoSoNhanVien.findOneAndUpdate(
        { employee_did: departmentData.truong_phong_did },
        { role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b' }, // Manager role_id
        { new: true }
      );
    }

    const danhMucPhongBan = new DanhMucPhongBan(departmentData);
    const newDanhMucPhongBan = await danhMucPhongBan.save();
    res.status(201).json(newDanhMucPhongBan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update department
const update = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // If truong_phong_did is being set, update the employee's role_id to Manager
    if (updateData.truong_phong_did) {
      const HoSoNhanVien = require('../models/HoSoNhanVien');
      await HoSoNhanVien.findOneAndUpdate(
        { employee_did: updateData.truong_phong_did },
        { role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b' }, // Manager role_id
        { new: true }
      );
    }

    // If truong_phong_did is being removed (set to null or empty), revert role to Employee
    if (updateData.truong_phong_did === null || updateData.truong_phong_did === '') {
      const HoSoNhanVien = require('../models/HoSoNhanVien');
      const currentDept = await DanhMucPhongBan.findOne({ phong_ban_id: req.params.id });
      if (currentDept && currentDept.truong_phong_did) {
        await HoSoNhanVien.findOneAndUpdate(
          { employee_did: currentDept.truong_phong_did },
          { role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c' }, // Employee role_id
          { new: true }
        );
      }
    }

    const updatedDanhMucPhongBan = await DanhMucPhongBan.findOneAndUpdate(
      { phong_ban_id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedDanhMucPhongBan) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json(updatedDanhMucPhongBan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Assign employee to department
const assignEmployeeToDepartment = async (req, res) => {
  try {
    const { employee_did } = req.body;
    const departmentId = req.params.id;

    // Get user's role
    const RolesPermissions = require('../models/RolesPermissions');
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: 'User role not found'
      });
    }

    // Check permissions based on role - Only Super Admin and Manager can assign employees
    if (userRole.ten_vai_tro !== 'Super Admin' && userRole.ten_vai_tro !== 'Manager') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin và Manager mới có quyền gán nhân viên vào phòng ban.'
      });
    }

    // Find the employee
    const HoSoNhanVien = require('../models/HoSoNhanVien');
    const employee = await HoSoNhanVien.findOne({ employee_did });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Update employee's department
    await HoSoNhanVien.findOneAndUpdate(
      { employee_did },
      { phong_ban_id: departmentId },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Employee assigned to department successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete department
const deleteDepartment = async (req, res) => {
  try {
    // Get the department before deleting to revert the department head's role
    const departmentToDelete = await DanhMucPhongBan.findOne({ phong_ban_id: req.params.id });
    if (!departmentToDelete) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // If the department has a department head, revert their role to Employee
    if (departmentToDelete.truong_phong_did) {
      const HoSoNhanVien = require('../models/HoSoNhanVien');
      await HoSoNhanVien.findOneAndUpdate(
        { employee_did: departmentToDelete.truong_phong_did },
        { role_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c' }, // Employee role_id
        { new: true }
      );
    }

    const deletedDanhMucPhongBan = await DanhMucPhongBan.findOneAndDelete({ phong_ban_id: req.params.id });
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove employee from department
const removeEmployeeFromDepartment = async (req, res) => {
  try {
    const { employeeDid } = req.params;

    // Get user's role
    const RolesPermissions = require('../models/RolesPermissions');
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: 'User role not found'
      });
    }

    // Find the employee
    const HoSoNhanVien = require('../models/HoSoNhanVien');
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check permissions based on role - Only Super Admin and Manager can remove employees
    if (userRole.ten_vai_tro !== 'Super Admin' && userRole.ten_vai_tro !== 'Manager') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin và Manager mới có quyền xóa nhân viên khỏi phòng ban.'
      });
    }

    // Check if the employee is a department head
    const department = await DanhMucPhongBan.findOne({ truong_phong_did: employeeDid });
    if (department) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove department head from department. Please assign a new department head first.'
      });
    }

    // Remove employee from department by setting phong_ban_id to null
    await HoSoNhanVien.findOneAndUpdate(
      { employee_did: employeeDid },
      { phong_ban_id: null },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Employee removed from department successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  assignEmployeeToDepartment,
  removeEmployeeFromDepartment,
  delete: deleteDepartment
};
