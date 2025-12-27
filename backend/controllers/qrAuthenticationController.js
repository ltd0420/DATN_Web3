const QrAuthentication = require('../models/QrAuthentication');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { getQRAuthContract, web3Utils, initializeWeb3, signer } = require('../config/web3');

// Get all QR authentications
exports.getAllQrAuthentication = async (req, res) => {
  try {
    const qrAuthentication = await QrAuthentication.find();
    res.json(qrAuthentication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get QR authentication by QR code ID
exports.getQrAuthenticationById = async (req, res) => {
  try {
    const qrAuthentication = await QrAuthentication.findOne({ qr_code_id: req.params.id });
    if (!qrAuthentication) {
      return res.status(404).json({ message: 'QR authentication not found' });
    }
    res.json(qrAuthentication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get QR authentications by employee DID
exports.getQrAuthenticationByEmployee = async (req, res) => {
  try {
    const qrAuthentication = await QrAuthentication.findOne({ employee_did: req.params.employeeDid });
    if (!qrAuthentication) {
    // If no QR code exists, create one
    const newQr = await createSimpleQR(req.params.employeeDid, req.body?.walletAddress);
      return res.json(newQr);
    }
    res.json(qrAuthentication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: create QR with optional blockchain integration
// Hiện tại, để tránh lỗi và đảm bảo hệ thống chạy ổn định,
// ta tạm thời dùng lại cơ chế createSimpleQR (chưa gọi smart contract).
// Sau này nếu cần tích hợp on-chain, chỉ cần bổ sung logic vào đây.
async function createBlockchainQR(employeeDid, walletAddress, createCount = 1) {
  return createSimpleQR(employeeDid, walletAddress, createCount);
}

// Generate new QR code for employee with blockchain integration
exports.generateNewQrCode = async (req, res) => {
  try {
    const { employeeDid } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ message: 'Wallet address is required for blockchain integration' });
    }

    // Find existing QR code
    let existingQr = await QrAuthentication.findOne({ employee_did: employeeDid });

    // Check if user has exceeded the limit (3 times per day)
    if (existingQr) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastCreateDate = existingQr.lan_tao_qr_cuoi ? new Date(existingQr.lan_tao_qr_cuoi) : null;
      lastCreateDate?.setHours(0, 0, 0, 0);

      if (lastCreateDate && lastCreateDate.getTime() === today.getTime()) {
        // Same day, check count
        if (existingQr.so_lan_tao_qr >= 3) {
          return res.status(429).json({
            message: 'Bạn đã tạo QR code quá 3 lần trong ngày hôm nay. Tài khoản sẽ bị tạm khóa để bảo mật.',
            locked: true
          });
        }
      } else {
        // Different day, reset counter
        existingQr.so_lan_tao_qr = 0;
      }
    }

    // Delete existing QR code if it exists
    if (existingQr) {
      await QrAuthentication.findOneAndDelete({ employee_did: employeeDid });
    }

    // Create new QR with blockchain integration
    const newQr = await createBlockchainQR(employeeDid, walletAddress, (existingQr ? existingQr.so_lan_tao_qr : 0) + 1);

    return res.json(newQr);
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function to create simple QR without blockchain
async function createSimpleQR(employeeDid, walletAddress, createCount = 1) {
  try {
    // Generate QR data
    const qrCodeId = crypto.randomUUID();
    const timestamp = Date.now();

    const qrData = {
      qr_code_id: qrCodeId,
      employee_did: employeeDid,
      wallet_address: walletAddress,
      timestamp: new Date().toISOString(),
      type: 'login_auth'
    };

    // Generate simple hash for validation
    const qrHash = crypto.createHash('sha256').update(JSON.stringify(qrData)).digest('hex');

    // Generate QR code image
    const qrImage = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Save to database
    const newQr = new QrAuthentication({
      qr_code_id: qrCodeId,
      employee_did: employeeDid,
      qr_hash: qrHash,
      qr_image: qrImage,
      trang_thai: 'Hoạt động',
      ngay_cap: new Date(),
      ngay_het_han: null,
      so_lan_su_dung: 0,
      lan_su_dung_cuoi: null,
      so_lan_tao_qr: createCount,
      lan_tao_qr_cuoi: new Date(),
      wallet_address: walletAddress
    });

    const savedQr = await newQr.save();
    return savedQr;
  } catch (error) {
    console.error('Create simple QR error:', error);
    throw error;
  }
}

// Validate QR code for login
exports.validateQrForLogin = async (req, res) => {
  try {
    const { qr_code_id, qr_hash } = req.body;

    if (!qr_code_id || !qr_hash) {
      return res.status(400).json({ message: 'QR code data is required' });
    }

    const qrAuthentication = await QrAuthentication.findOne({
      qr_code_id: qr_code_id,
      qr_hash: qr_hash,
      trang_thai: 'Hoạt động'
    });

    if (!qrAuthentication) {
      return res.status(404).json({ message: 'Invalid or inactive QR code' });
    }

    if (qrAuthentication.ngay_het_han && new Date() > qrAuthentication.ngay_het_han) {
      return res.status(400).json({ message: 'QR code has expired' });
    }

    // Increment usage count and update last used time
    qrAuthentication.so_lan_su_dung += 1;
    qrAuthentication.lan_su_dung_cuoi = new Date();
    await qrAuthentication.save();

    res.json({
      success: true,
      employee_did: qrAuthentication.employee_did,
      qr_image: qrAuthentication.qr_image,
      message: 'QR code validated successfully'
    });
  } catch (error) {
    console.error('Validate QR error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get QR authentications by status
exports.getQrAuthenticationByStatus = async (req, res) => {
  try {
    const qrAuthentication = await QrAuthentication.find({ trang_thai: req.params.status });
    res.json(qrAuthentication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new QR authentication
exports.createQrAuthentication = async (req, res) => {
  const qrAuthentication = new QrAuthentication(req.body);
  try {
    const newQrAuthentication = await qrAuthentication.save();
    res.status(201).json(newQrAuthentication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update QR authentication
exports.updateQrAuthentication = async (req, res) => {
  try {
    const updatedQrAuthentication = await QrAuthentication.findOneAndUpdate(
      { qr_code_id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedQrAuthentication) {
      return res.status(404).json({ message: 'QR authentication not found' });
    }
    res.json(updatedQrAuthentication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete QR authentication
exports.deleteQrAuthentication = async (req, res) => {
  try {
    const deletedQrAuthentication = await QrAuthentication.findOneAndDelete({ qr_code_id: req.params.id });
    if (!deletedQrAuthentication) {
      return res.status(404).json({ message: 'QR authentication not found' });
    }
    res.json({ message: 'QR authentication deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Revoke QR authentication
exports.revokeQrAuthentication = async (req, res) => {
  try {
    const qrAuthentication = await QrAuthentication.findOne({ qr_code_id: req.params.id });

    if (!qrAuthentication) {
      return res.status(404).json({ message: 'QR authentication not found' });
    }

    // Update database
    const updatedQrAuthentication = await QrAuthentication.findOneAndUpdate(
      { qr_code_id: req.params.id },
      {
        trang_thai: 'Đã thu hồi',
        ngay_het_han: new Date()
      },
      { new: true }
    );

    res.json(updatedQrAuthentication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Validate QR authentication (increment usage count)
exports.validateQrAuthentication = async (req, res) => {
  try {
    const qrAuthentication = await QrAuthentication.findOne({ qr_code_id: req.params.id });

    if (!qrAuthentication) {
      return res.status(404).json({ message: 'QR authentication not found' });
    }

    if (qrAuthentication.trang_thai !== 'Hoạt động') {
      return res.status(400).json({ message: 'QR authentication is not active' });
    }

    if (qrAuthentication.ngay_het_han && new Date() > qrAuthentication.ngay_het_han) {
      return res.status(400).json({ message: 'QR authentication has expired' });
    }

    // Increment usage count and update last used time
    qrAuthentication.so_lan_su_dung += 1;
    qrAuthentication.lan_su_dung_cuoi = new Date();
    await qrAuthentication.save();

    res.json(qrAuthentication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Welcome endpoint for QR authentication with logging
exports.welcomeQr = async (req, res) => {
  try {
    // Log request metadata
    const EventLogsUser = require('../models/EventLogsUser');
    const logEntry = new EventLogsUser({
      user_did: null, // No specific user for welcome
      event_type: 'QR_AUTH_REQUEST',
      message: `QR Authentication request: ${req.method} ${req.path}`,
      resource_type: 'qr_auth',
      resource_id: null,
      is_read: false,
      timestamp: new Date()
    });

    // Add metadata to message
    logEntry.message += ` | IP: ${req.ip || req.connection.remoteAddress} | User-Agent: ${req.get('User-Agent')}`;

    await logEntry.save();

    // Return welcome message
    res.json({
      message: 'Welcome to the QR Authentication System!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Welcome QR error:', error);
    res.status(500).json({ message: error.message });
  }
};
