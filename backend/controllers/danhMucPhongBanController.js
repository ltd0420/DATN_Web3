const DanhMucPhongBan = require('../models/DanhMucPhongBan');
const DepartmentWeb3 = require('../models/DepartmentWeb3');
const { v4: uuidv4 } = require('uuid');
const departmentWeb3Service = require('../services/departmentWeb3Service');

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

    // Tự động tạo phòng ban Web3 tương ứng (bao gồm tạo trên blockchain)
    try {
      const web3DepartmentData = {
        department_id: newDanhMucPhongBan.phong_ban_id, // Dùng phong_ban_id làm department_id
        phong_ban_id: newDanhMucPhongBan.phong_ban_id, // Liên kết với phòng ban thường
        department_name: newDanhMucPhongBan.ten_phong_ban,
        require_test: true, // Mặc định yêu cầu test
        min_test_score: 70, // Điểm tối thiểu mặc định
        is_active: true
      };

      // Kiểm tra xem đã có phòng ban Web3 chưa
      const existingWeb3Dept = await DepartmentWeb3.findOne({ 
        department_id: newDanhMucPhongBan.phong_ban_id 
      });

      if (!existingWeb3Dept) {
        // Sử dụng departmentWeb3Service để tạo department (bao gồm tạo trên blockchain)
        const web3Department = await departmentWeb3Service.createDepartment(web3DepartmentData);
        console.log(`[danhMucPhongBan] Created Web3 department: ${web3Department.department_id}`);
        if (web3Department.blockchain_tx_hash) {
          console.log(`[danhMucPhongBan] Web3 department created on blockchain: ${web3Department.blockchain_tx_hash}`);
        } else {
          console.log(`[danhMucPhongBan] Web3 department created off-chain only (blockchain not available or failed)`);
        }
      }
    } catch (web3Error) {
      console.error('[danhMucPhongBan] Failed to create Web3 department:', web3Error);
      // Không throw error, vì phòng ban thường đã tạo thành công
    }

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

    // Cập nhật phòng ban Web3 tương ứng nếu có
    try {
      const web3Department = await DepartmentWeb3.findOne({ phong_ban_id: req.params.id });
      if (web3Department) {
        // Cập nhật tên phòng ban nếu có thay đổi
        if (updateData.ten_phong_ban) {
          await DepartmentWeb3.findOneAndUpdate(
            { phong_ban_id: req.params.id },
            { department_name: updateData.ten_phong_ban },
            { new: true }
          );
          console.log(`[danhMucPhongBan] Updated Web3 department name: ${req.params.id}`);
        }
      }
    } catch (web3Error) {
      console.error('[danhMucPhongBan] Failed to update Web3 department:', web3Error);
      // Không throw error, vì phòng ban thường đã cập nhật thành công
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
    
    // Xóa phòng ban Web3 tương ứng nếu có
    try {
      await DepartmentWeb3.findOneAndDelete({ phong_ban_id: req.params.id });
      console.log(`[danhMucPhongBan] Deleted Web3 department: ${req.params.id}`);
    } catch (web3Error) {
      console.error('[danhMucPhongBan] Failed to delete Web3 department:', web3Error);
      // Không throw error, vì phòng ban thường đã xóa thành công
    }
    
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

    // Get the employee's current department before removing
    const oldDepartmentId = employee.phong_ban_id;

    // Remove employee from department by setting phong_ban_id to null
    await HoSoNhanVien.findOneAndUpdate(
      { employee_did: employeeDid },
      { phong_ban_id: null },
      { new: true }
    );

    // Xóa test submission và test result của nhân viên cho phòng ban này
    // để họ có thể làm lại test khi muốn tham gia lại phòng ban
    if (oldDepartmentId) {
      try {
        const TestSubmission = require('../models/TestSubmission');
        const TestResult = require('../models/TestResult');
        const DepartmentWeb3 = require('../models/DepartmentWeb3');
        
        // Tìm Web3 department tương ứng với phòng ban thường
        const web3Department = await DepartmentWeb3.findOne({ phong_ban_id: oldDepartmentId });
        
        if (web3Department) {
          // Xóa test submission và test result
          await TestSubmission.deleteMany({
            employee_did: employeeDid,
            department_id: web3Department.department_id
          });
          
          await TestResult.deleteMany({
            employee_did: employeeDid,
            department_id: web3Department.department_id
          });
          
          console.log(`[danhMucPhongBan] Deleted test data for employee ${employeeDid} from department ${web3Department.department_id}`);
        }
      } catch (testError) {
        console.error('[danhMucPhongBan] Error deleting test data:', testError);
        // Không throw error, vì việc xóa nhân viên đã thành công
      }
    }

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
