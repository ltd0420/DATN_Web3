const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const RolesPermissions = require('../models/RolesPermissions');
const AuditLogs = require('../models/AuditLogs');
const EventLogsUser = require('../models/EventLogsUser');
const SmartContractLogs = require('../models/SmartContractLogs');
const { web3Utils } = require('../config/web3');

// Store challenges temporarily (in production, use Redis or database)
const challenges = new Map();

// Generate challenge for wallet authentication
const generateChallenge = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    // Generate a unique challenge with more detailed information
    const nonce = uuidv4().substring(0, 8);
    const timestamp = new Date().toISOString();
    const challenge = `Cổng Thông Tin Nhân Sự - Đăng nhập bằng ví điện tử

Thông tin đăng nhập:
- Thời gian: ${timestamp}
- Nonce: ${nonce}
- Địa chỉ ví: ${walletAddress}

Vui lòng ký thông báo này để xác thực danh tính của bạn.`;
    const challengeId = uuidv4();

    // Store challenge with expiration (5 minutes)
    challenges.set(challengeId, {
      challenge,
      walletAddress: walletAddress.toLowerCase(),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    // Clean up expired challenges
    for (const [id, data] of challenges.entries()) {
      if (data.expiresAt < Date.now()) {
        challenges.delete(id);
      }
    }

    res.json({
      success: true,
      challengeId,
      challenge,
      message: 'Please sign this message with your MetaMask wallet'
    });

  } catch (error) {
    console.error('Generate challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate challenge'
    });
  }
};

// Verify signature and authenticate user
const verifySignature = async (req, res) => {
  try {
    const { challengeId, signature, consentTransactionHash } = req.body;

    // Get challenge from store
    const challengeData = challenges.get(challengeId);
    if (!challengeData) {
      return res.status(400).json({
        success: false,
        message: 'Challenge not found or expired'
      });
    }

    // Check if challenge expired
    if (challengeData.expiresAt < Date.now()) {
      challenges.delete(challengeId);
      return res.status(400).json({
        success: false,
        message: 'Challenge expired'
      });
    }

    const { challenge, walletAddress } = challengeData;

    // Verify signature using Web3 utilities
    let isValidSignature = false;
    try {
      isValidSignature = web3Utils.verifySignature(
        challenge,
        signature,
        walletAddress
      );
      console.log('Signature verification result:', isValidSignature);
    } catch (error) {
      console.error('Signature verification error:', error);
      isValidSignature = false;
    }

    if (!isValidSignature) {
      // Log failed authentication attempt
      await AuditLogs.create({
        user_did: null, // No user ID yet
        action: 'LOGIN_FAILED',
        resource_type: 'authentication',
        resource_id: walletAddress,
        status: 'Failed',
        error_message: 'Invalid signature verification',
        timestamp: new Date()
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid signature. Please ensure you are signing with the correct wallet.'
      });
    }

    // Find employee by wallet address
    let employee = await HoSoNhanVien.findOne({
      walletAddress: walletAddress.toLowerCase()
    });

    if (!employee) {
      // Wallet not found - this is a new registration
      // Generate new employee DID using UUID v4
      const employeeDid = uuidv4();

      // Get default role for new employees (Employee role)
      const defaultRole = await RolesPermissions.findOne({ ten_vai_tro: 'Employee' });
      const defaultRoleId = defaultRole ? defaultRole.role_id : null;

      // Create new employee record with minimal required fields
      employee = new HoSoNhanVien({
        employee_did: employeeDid,
        walletAddress: walletAddress.toLowerCase(),
        wallet_verified: true,
        chuc_vu: 'Intern', // Default role
        phong_ban_id: '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a', // Default department (Phòng Nhân sự)
        role_id: defaultRoleId,
        trang_thai: 'Đang làm việc',
        ngay_vao_lam: new Date().toISOString().split('T')[0], // Today's date
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await employee.save();

      // Log new employee registration
      await AuditLogs.create({
        user_did: employeeDid,
        action: 'REGISTER',
        resource_type: 'ho_so_nhan_vien',
        resource_id: employee._id.toString(),
        status: 'Success',
        timestamp: new Date()
      });

      // Log user event for new registration
      await EventLogsUser.create({
        user_did: employeeDid,
        event_type: 'register',
        message: 'Đăng ký tài khoản mới bằng MetaMask',
        resource_type: 'authentication',
        resource_id: employee._id.toString(),
        timestamp: new Date()
      });

    } else {
      // Existing employee - update last login time
      await HoSoNhanVien.updateOne(
        { _id: employee._id },
        {
          updatedAt: new Date()
        }
      );

      // Log successful login for existing user
      await AuditLogs.create({
        user_did: employee.employee_did,
        action: 'LOGIN',
        resource_type: 'authentication',
        resource_id: employee._id.toString(),
        status: 'Success',
        timestamp: new Date()
      });

      // Log user event for login
      await EventLogsUser.create({
        user_did: employee.employee_did,
        event_type: 'login',
        message: 'Đăng nhập thành công bằng MetaMask',
        resource_type: 'authentication',
        resource_id: employee._id.toString(),
        timestamp: new Date()
      });
    }

    // Update wallet verification status
    await HoSoNhanVien.updateOne(
      { _id: employee._id },
      {
        wallet_verified: true,
        updatedAt: new Date()
      }
    );

    // Update consent pointer if provided
    if (consentTransactionHash) {
      await HoSoNhanVien.updateOne(
        { _id: employee._id },
        {
          consent_pointer: consentTransactionHash,
          updatedAt: new Date()
        }
      );

      // Log smart contract interaction only if it's a valid transaction hash (64 chars)
      const transactionHashRegex = /^0x[0-9a-fA-F]{64}$/;
      if (transactionHashRegex.test(consentTransactionHash)) {
        await SmartContractLogs.create({
          contract_address: process.env.CONSENT_CONTRACT || '0x0000000000000000000000000000000000000000',
          transaction_hash: consentTransactionHash,
          function_name: 'giveConsent',
          parameters: {
            employee_did: employee.employee_did,
            wallet_address: walletAddress
          },
          status: 'Success',
          timestamp: new Date(),
          createdAt: new Date()
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        employee_did: employee.employee_did,
        walletAddress: employee.walletAddress,
        chuc_vu: employee.chuc_vu,
        role_id: employee.role_id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Log successful login
    await AuditLogs.create({
      user_did: employee.employee_did,
      action: 'LOGIN',
      resource_type: 'authentication',
      resource_id: employee._id.toString(),
      status: 'Success',
      timestamp: new Date()
    });

    // Log user event
    await EventLogsUser.create({
      user_did: employee.employee_did,
      event_type: 'login',
      message: 'Đăng nhập thành công bằng MetaMask',
      resource_type: 'authentication',
      resource_id: employee._id.toString(),
      timestamp: new Date()
    });

    // Clean up used challenge
    challenges.delete(challengeId);

    res.json({
      success: true,
      token,
      user: {
        employee_did: employee.employee_did,
        chuc_vu: employee.chuc_vu,
        phong_ban_id: employee.phong_ban_id,
        role_id: employee.role_id,
        walletAddress: employee.walletAddress,
        wallet_verified: true
      },
      message: 'Authentication successful'
    });

  } catch (error) {
    console.error('Verify signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const { employee_did } = req.user;

    // Log logout event
    await EventLogsUser.create({
      user_did: employee_did,
      event_type: 'logout',
      message: 'Đăng xuất khỏi hệ thống',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const { employee_did } = req.user;

    const employee = await HoSoNhanVien.findOne({ employee_did })
      .populate('phong_ban_id', 'ten_phong_ban')
      .select('-vc_uris -ai_profile_summary');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      user: employee
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = authHeader;
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', { clockTolerance: 300 }, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();
  });
};

module.exports = {
  generateChallenge,
  verifySignature,
  logout,
  getProfile,
  authenticateToken
};
