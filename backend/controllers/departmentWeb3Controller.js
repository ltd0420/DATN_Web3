const departmentWeb3Service = require('../services/departmentWeb3Service');
const DepartmentWeb3 = require('../models/DepartmentWeb3');
const DepartmentMember = require('../models/DepartmentMember');
const TestResult = require('../models/TestResult');
const VotingPeriod = require('../models/VotingPeriod');
const VotingCandidate = require('../models/VotingCandidate');
const VotingVote = require('../models/VotingVote');

// Get all departments
const getAllDepartments = async (req, res) => {
  try {
    const departments = await DepartmentWeb3.find().sort({ created_at: -1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get department by ID (supports both department_id and phong_ban_id)
const getDepartmentById = async (req, res) => {
  try {
    // Try to find by department_id first, then by phong_ban_id
    let department = await DepartmentWeb3.findOne({ department_id: req.params.id });
    if (!department) {
      // If not found, try to find by phong_ban_id
      department = await DepartmentWeb3.findOne({ phong_ban_id: req.params.id });
    }
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Get member count - use department_id from found department
    const memberCount = await DepartmentMember.countDocuments({
      department_id: department.department_id,
      is_active: true
    });
    
    // Get current user's member info if employeeDid is provided
    let memberInfo = null;
    if (req.query.employeeDid) {
      const member = await DepartmentMember.findOne({
        department_id: department.department_id,
        employee_did: req.query.employeeDid,
        is_active: true
      });
      console.log('[getDepartmentById] Member lookup:', {
        department_id: department.department_id,
        employeeDid: req.query.employeeDid,
        memberFound: !!member,
        blockchain_tx_hash: member?.blockchain_tx_hash
      });
      if (member) {
        memberInfo = {
          blockchain_tx_hash: member.blockchain_tx_hash,
          blockchain_block_number: member.blockchain_block_number,
          joined_at: member.joined_at
        };
      }
    }
    
    const response = {
      ...department.toObject(),
      member_count: memberCount
    };
    
    if (memberInfo) {
      response.member = memberInfo;
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new department
const createDepartment = async (req, res) => {
  try {
    const department = await departmentWeb3Service.createDepartment(req.body);
    res.status(201).json(department);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Check qualification
const checkQualification = async (req, res) => {
  try {
    const { departmentId, employeeDid } = req.params;
    const qualification = await departmentWeb3Service.checkQualification(
      departmentId,
      employeeDid
    );
    res.json(qualification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join department
const joinDepartment = async (req, res) => {
  try {
    const { departmentId, employeeDid, walletAddress } = req.body;
    
    const result = await departmentWeb3Service.joinDepartment(
      departmentId,
      employeeDid,
      walletAddress
    );
    
    res.status(201).json({
      success: true,
      member: result.member,
      qualification: result.qualification,
      message: 'Successfully joined department'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get department members
const getDepartmentMembers = async (req, res) => {
  try {
    const members = await DepartmentMember.find({
      department_id: req.params.id,
      is_active: true
    }).sort({ joined_at: -1 });
    
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get employee departments
const getEmployeeDepartments = async (req, res) => {
  try {
    const members = await DepartmentMember.find({
      employee_did: req.params.employeeDid,
      is_active: true
    }).populate('department_id', 'department_name');
    
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete department
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[deleteDepartment] Request received:', { id, params: req.params });
    const result = await departmentWeb3Service.deleteDepartment(id);
    console.log('[deleteDepartment] Success:', result);
    res.json(result);
  } catch (error) {
    console.error('[deleteDepartment] Error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  checkQualification,
  joinDepartment,
  getDepartmentMembers,
  getEmployeeDepartments,
  deleteDepartment
};

