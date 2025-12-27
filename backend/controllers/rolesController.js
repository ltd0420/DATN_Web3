const RolesPermissions = require('../models/RolesPermissions');
const AuditLogs = require('../models/AuditLogs');
const { authenticateToken } = require('./authController');

// Get all roles
const getAllRoles = async (req, res) => {
  try {
    const roles = await RolesPermissions.find({ trang_thai: 'Hoạt động' })
      .select('-permissions.system_settings.manage_roles -permissions.system_settings.manage_integrations -permissions.system_settings.view_audit_logs')
      .sort({ cap_do_uu_tien: -1 });

    res.json({
      success: true,
      roles
    });
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get roles'
    });
  }
};

// Get role by ID
const getRoleById = async (req, res) => {
  try {
    const { role_id } = req.params;

    const role = await RolesPermissions.findOne({ role_id, trang_thai: 'Hoạt động' });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.json({
      success: true,
      role
    });
  } catch (error) {
    console.error('Get role by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get role'
    });
  }
};

// Create new role (Super Admin only)
const createRole = async (req, res) => {
  try {
    const { ten_vai_tro, mo_ta, permissions, cap_do_uu_tien } = req.body;
    const { employee_did } = req.user;

    // Check if user has Super Admin role
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || userRole.ten_vai_tro !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Check if role name already exists
    const existingRole = await RolesPermissions.findOne({ ten_vai_tro });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role name already exists'
      });
    }

    // Generate role_id using UUID v7 format
    const roleId = require('uuid').v4().replace(/-/g, '').substring(0, 32);

    const newRole = new RolesPermissions({
      role_id: roleId,
      ten_vai_tro,
      mo_ta,
      permissions,
      cap_do_uu_tien: cap_do_uu_tien || 1
    });

    await newRole.save();

    // Log role creation
    await AuditLogs.create({
      user_did: employee_did,
      action: 'CREATE_ROLE',
      resource_type: 'roles_permissions',
      resource_id: newRole._id.toString(),
      status: 'Success',
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      role: newRole,
      message: 'Role created successfully'
    });

  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create role'
    });
  }
};

// Update role (Super Admin only)
const updateRole = async (req, res) => {
  try {
    const { role_id } = req.params;
    const { ten_vai_tro, mo_ta, permissions, cap_do_uu_tien, trang_thai } = req.body;
    const { employee_did } = req.user;

    // Check if user has Super Admin role
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || userRole.ten_vai_tro !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const role = await RolesPermissions.findOne({ role_id });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Update role fields
    if (ten_vai_tro) role.ten_vai_tro = ten_vai_tro;
    if (mo_ta !== undefined) role.mo_ta = mo_ta;
    if (permissions) role.permissions = permissions;
    if (cap_do_uu_tien) role.cap_do_uu_tien = cap_do_uu_tien;
    if (trang_thai) role.trang_thai = trang_thai;

    await role.save();

    // Log role update
    await AuditLogs.create({
      user_did: employee_did,
      action: 'UPDATE_ROLE',
      resource_type: 'roles_permissions',
      resource_id: role._id.toString(),
      status: 'Success',
      timestamp: new Date()
    });

    res.json({
      success: true,
      role,
      message: 'Role updated successfully'
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role'
    });
  }
};

// Delete role (Super Admin only)
const deleteRole = async (req, res) => {
  try {
    const { role_id } = req.params;
    const { employee_did } = req.user;

    // Check if user has Super Admin role
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || userRole.ten_vai_tro !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Prevent deletion of default roles
    const defaultRoles = ['Super Admin', 'Manager', 'Employee'];
    const role = await RolesPermissions.findOne({ role_id });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    if (defaultRoles.includes(role.ten_vai_tro)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default roles'
      });
    }

    await RolesPermissions.findOneAndDelete({ role_id });

    // Log role deletion
    await AuditLogs.create({
      user_did: employee_did,
      action: 'DELETE_ROLE',
      resource_type: 'roles_permissions',
      resource_id: role_id,
      status: 'Success',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role'
    });
  }
};

// Get user permissions
const getUserPermissions = async (req, res) => {
  try {
    const { role_id } = req.user;

    const role = await RolesPermissions.findOne({ role_id, trang_thai: 'Hoạt động' });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.json({
      success: true,
      permissions: role.permissions,
      role_name: role.ten_vai_tro
    });

  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get permissions'
    });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getUserPermissions
};
