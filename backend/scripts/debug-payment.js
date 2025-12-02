/**
 * Script để debug payment issues
 * 
 * Usage: node scripts/debug-payment.js [employee_did]
 */

require('dotenv').config();
const payrollContractService = require('../services/payrollContractService');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function debugPayment(employeeDid = null) {
  try {
    console.log('='.repeat(60));
    console.log('PAYMENT DEBUG SCRIPT');
    console.log('='.repeat(60));
    console.log('');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    console.log('');

    // 1. Check environment variables
    console.log('1. Checking Environment Variables:');
    console.log('   HR_PAYROLL_ADDRESS:', process.env.HR_PAYROLL_ADDRESS || 'NOT SET');
    console.log('   HR_PAYROLL_PRIVATE_KEY:', process.env.HR_PAYROLL_PRIVATE_KEY ? 'SET (hidden)' : 'NOT SET');
    console.log('   TOKEN_ADDRESS:', process.env.TOKEN_ADDRESS || 'NOT SET (will auto-detect)');
    console.log('   RPC_URL:', process.env.RPC_URL || 'NOT SET (default: localhost)');
    console.log('');

    // 2. Initialize payroll service
    console.log('2. Initializing Payroll Service...');
    try {
      await payrollContractService.initializePayrollService();
      console.log('   ✅ Payroll service initialized');
    } catch (error) {
      console.error('   ❌ Failed to initialize:', error.message);
      console.error('   Full error:', error);
      return;
    }
    console.log('');

    // 3. Get contract info
    console.log('3. Contract Information:');
    try {
      const contractInfo = await payrollContractService.getContractInfo();
      console.log('   Contract Address:', contractInfo.contractAddress);
      console.log('   Contract Admin:', contractInfo.contractAdmin);
      console.log('   Signer Address:', contractInfo.signerAddress);
      console.log('   Signer ETH Balance:', contractInfo.signerEthBalance, 'ETH');
      console.log('   Token Address:', contractInfo.tokenAddress);
      console.log('   Token Symbol:', contractInfo.tokenSymbol);
      console.log('   Contract Token Balance:', contractInfo.contractTokenBalance, contractInfo.tokenSymbol);
      console.log('   RPC URL:', contractInfo.rpcUrl);
      
      // Check if signer is admin
      if (contractInfo.signerAddress.toLowerCase() !== contractInfo.contractAdmin.toLowerCase()) {
        console.log('   ⚠️  WARNING: Signer address is NOT the contract admin!');
        console.log('      Signer:', contractInfo.signerAddress);
        console.log('      Admin:', contractInfo.contractAdmin);
      } else {
        console.log('   ✅ Signer is contract admin');
      }
      
      // Check ETH balance
      const ethBalance = parseFloat(contractInfo.signerEthBalance);
      if (ethBalance < 0.001) {
        console.log('   ⚠️  WARNING: Low ETH balance! May fail due to insufficient gas.');
        console.log('      Current:', contractInfo.signerEthBalance, 'ETH');
        console.log('      Recommended: At least 0.01 ETH');
      } else {
        console.log('   ✅ ETH balance sufficient for gas');
      }
      
      // Check token balance
      const tokenBalance = parseFloat(contractInfo.contractTokenBalance);
      if (tokenBalance < 1) {
        console.log('   ⚠️  WARNING: Contract has low token balance!');
        console.log('      Current:', contractInfo.contractTokenBalance, contractInfo.tokenSymbol);
        console.log('      Recommended: At least 1000', contractInfo.tokenSymbol);
      } else {
        console.log('   ✅ Contract token balance sufficient');
      }
    } catch (error) {
      console.error('   ❌ Failed to get contract info:', error.message);
      console.error('   Full error:', error);
    }
    console.log('');

    // 4. Check employee (if provided)
    if (employeeDid) {
      console.log('4. Checking Employee:', employeeDid);
      try {
        const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
        if (!employee) {
          console.log('   ❌ Employee not found');
        } else {
          console.log('   ✅ Employee found:', employee.ho_ten || employee.ten_nhan_vien);
          if (!employee.walletAddress) {
            console.log('   ❌ Employee does NOT have wallet address!');
            console.log('      Action: Add wallet address to employee profile');
          } else {
            console.log('   ✅ Employee wallet address:', employee.walletAddress);
            
            // Check if wallet address is valid
            const { ethers } = require('ethers');
            try {
              const normalizedAddress = ethers.getAddress(employee.walletAddress);
              console.log('   ✅ Wallet address is valid:', normalizedAddress);
            } catch (error) {
              console.log('   ❌ Invalid wallet address format:', employee.walletAddress);
            }
          }
        }
      } catch (error) {
        console.error('   ❌ Error checking employee:', error.message);
      }
      console.log('');
    }

    // 5. Test payment (if employee provided)
    if (employeeDid) {
      console.log('5. Testing Payment (1 TUSD):');
      try {
        const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
        if (!employee || !employee.walletAddress) {
          console.log('   ❌ Cannot test: Employee not found or no wallet address');
        } else {
          console.log('   Attempting to pay 1 TUSD to:', employee.walletAddress);
          const result = await payrollContractService.payTaskReward(employeeDid, 1, 'test-payment');
          if (result.success) {
            console.log('   ✅ Payment successful!');
            console.log('   Transaction Hash:', result.transactionHash);
            console.log('   Block Number:', result.blockNumber);
            console.log('   View on Etherscan:', `https://sepolia.etherscan.io/tx/${result.transactionHash}`);
          } else {
            console.log('   ❌ Payment failed:', result.error || result.message);
          }
        }
      } catch (error) {
        console.error('   ❌ Payment test failed:', error.message);
        console.error('   Full error:', error);
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('DEBUG COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Get employee DID from command line
const employeeDid = process.argv[2] || null;

debugPayment(employeeDid);

