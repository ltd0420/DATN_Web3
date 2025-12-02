const { getConsentContract } = require('../config/web3');
const SmartContractLogs = require('../models/SmartContractLogs');

// Give consent for data processing
const giveConsent = async (req, res) => {
  try {
    const { employeeDid, consentType, purpose, duration, ipfsHash } = req.body;

    if (!employeeDid || !consentType || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Employee DID, consent type, and purpose are required'
      });
    }

    const consentContract = getConsentContract();

    // Call the smart contract to give consent
    const tx = await consentContract.giveConsent(
      employeeDid,
      consentType,
      purpose,
      duration || 0, // 0 for permanent consent
      ipfsHash || ''
    );

    const receipt = await tx.wait();

    // Extract consent ID from transaction logs
    const consentId = receipt.logs[0].topics[1]; // Assuming consent ID is in the first topic

    // Log smart contract interaction
    await SmartContractLogs.create({
      contract_address: process.env.CONSENT_CONTRACT,
      transaction_hash: receipt.transactionHash,
      function_name: 'giveConsent',
      parameters: {
        employeeDid,
        consentType,
        purpose,
        duration,
        ipfsHash
      },
      status: 'Success',
      timestamp: new Date(),
      createdAt: new Date()
    });

    res.json({
      success: true,
      consentId: parseInt(consentId, 16),
      transactionHash: receipt.transactionHash,
      message: 'Consent given successfully'
    });

  } catch (error) {
    console.error('Give consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to give consent'
    });
  }
};

// Revoke consent
const revokeConsent = async (req, res) => {
  try {
    const { consentId } = req.params;

    if (!consentId) {
      return res.status(400).json({
        success: false,
        message: 'Consent ID is required'
      });
    }

    const consentContract = getConsentContract();

    // Call the smart contract to revoke consent
    const tx = await consentContract.revokeConsent(consentId);
    const receipt = await tx.wait();

    // Log smart contract interaction
    await SmartContractLogs.create({
      contract_address: process.env.CONSENT_CONTRACT,
      transaction_hash: receipt.transactionHash,
      function_name: 'revokeConsent',
      parameters: { consentId },
      status: 'Success',
      timestamp: new Date(),
      createdAt: new Date()
    });

    res.json({
      success: true,
      transactionHash: receipt.transactionHash,
      message: 'Consent revoked successfully'
    });

  } catch (error) {
    console.error('Revoke consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke consent'
    });
  }
};

// Check if consent is valid
const checkConsent = async (req, res) => {
  try {
    const { consentId } = req.params;

    if (!consentId) {
      return res.status(400).json({
        success: false,
        message: 'Consent ID is required'
      });
    }

    const consentContract = getConsentContract();
    const isValid = await consentContract.isConsentValid(consentId);

    res.json({
      success: true,
      consentId: parseInt(consentId),
      isValid
    });

  } catch (error) {
    console.error('Check consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check consent validity'
    });
  }
};

// Check if employee has active consent for specific type
const checkActiveConsent = async (req, res) => {
  try {
    const { employeeDid, consentType } = req.params;

    if (!employeeDid || !consentType) {
      return res.status(400).json({
        success: false,
        message: 'Employee DID and consent type are required'
      });
    }

    const consentContract = getConsentContract();
    const hasActive = await consentContract.hasActiveConsent(employeeDid, consentType);

    res.json({
      success: true,
      employeeDid,
      consentType,
      hasActiveConsent: hasActive
    });

  } catch (error) {
    console.error('Check active consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check active consent'
    });
  }
};

// Get all consents for an employee
const getEmployeeConsents = async (req, res) => {
  try {
    const { employeeDid } = req.params;

    if (!employeeDid) {
      return res.status(400).json({
        success: false,
        message: 'Employee DID is required'
      });
    }

    // Check if consent contract is deployed
    let consentContract;
    try {
      consentContract = getConsentContract();
    } catch (contractError) {
      console.log('Demo mode: Consent contract not deployed, returning empty consents');
      return res.json({
        success: true,
        employeeDid,
        consents: [],
        message: 'Consent management not available in demo mode'
      });
    }

    const consentIds = await consentContract.getEmployeeConsents(employeeDid);

    // Get detailed consent information for each ID
    const consents = [];
    for (const id of consentIds) {
      const consent = await consentContract.getConsent(id);
      consents.push({
        consentId: parseInt(id),
        employeeDid: consent[1],
        walletAddress: consent[2],
        consentType: consent[3],
        purpose: consent[4],
        issuedAt: new Date(parseInt(consent[5]) * 1000),
        expiresAt: consent[6] > 0 ? new Date(parseInt(consent[6]) * 1000) : null,
        isActive: consent[7],
        ipfsHash: consent[8]
      });
    }

    res.json({
      success: true,
      employeeDid,
      consents
    });

  } catch (error) {
    console.error('Get employee consents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get employee consents'
    });
  }
};

// Get consent details
const getConsentDetails = async (req, res) => {
  try {
    const { consentId } = req.params;

    if (!consentId) {
      return res.status(400).json({
        success: false,
        message: 'Consent ID is required'
      });
    }

    const consentContract = getConsentContract();
    const consent = await consentContract.getConsent(consentId);

    res.json({
      success: true,
      consent: {
        consentId: parseInt(consent[0]),
        employeeDid: consent[1],
        walletAddress: consent[2],
        consentType: consent[3],
        purpose: consent[4],
        issuedAt: new Date(parseInt(consent[5]) * 1000),
        expiresAt: consent[6] > 0 ? new Date(parseInt(consent[6]) * 1000) : null,
        isActive: consent[7],
        ipfsHash: consent[8]
      }
    });

  } catch (error) {
    console.error('Get consent details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consent details'
    });
  }
};

module.exports = {
  giveConsent,
  revokeConsent,
  checkConsent,
  checkActiveConsent,
  getEmployeeConsents,
  getConsentDetails
};
