/**
 * Script để test payment trực tiếp với employee DID
 * 
 * Usage: node scripts/test-payment-direct.js <employee_did> <amount>
 * Example: node scripts/test-payment-direct.js 01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c 10
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const payrollContractService = require('../services/payrollContractService');
const HoSoNhanVien = require('../models/HoSoNhanVien');

async function testPayment(employeeDid, amount = 10) {
  try {
    console.log('='.repeat(60));
    console.log('TEST PAYMENT DIRECT');
    console.log('='.repeat(60));
    console.log('');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    console.log('');

    // Check employee
    console.log('1. Checking Employee:', employeeDid);
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    if (!employee) {
      console.error('❌ Employee not found:', employeeDid);
      process.exit(1);
    }
    console.log('   ✅ Employee found:', employee.ho_ten || employee.ten_nhan_vien);
    
    if (!employee.walletAddress) {
      console.error('❌ Employee does NOT have wallet address!');
      console.error('   Action: Add wallet address to employee profile');
      process.exit(1);
    }
    console.log('   ✅ Employee wallet address:', employee.walletAddress);
    console.log('');

    // Initialize service
    console.log('2. Initializing Payroll Service...');
    await payrollContractService.initializePayrollService();
    console.log('   ✅ Service initialized');
    console.log('');

    // Get contract info
    console.log('3. Contract Status:');
    const contractInfo = await payrollContractService.getContractInfo();
    console.log('   Contract Balance:', contractInfo.contractTokenBalance, contractInfo.tokenSymbol);
    console.log('   Signer ETH:', contractInfo.signerEthBalance, 'ETH');
    console.log('');

    // Test payment
    console.log(`4. Testing Payment: ${amount} ${contractInfo.tokenSymbol}`);
    console.log('   To:', employee.walletAddress);
    console.log('');
    
    const result = await payrollContractService.payTaskReward(
      employeeDid,
      amount,
      'test-payment-direct'
    );

    if (result.success) {
      console.log('='.repeat(60));
      console.log('✅ PAYMENT SUCCESSFUL!');
      console.log('='.repeat(60));
      console.log('Transaction Hash:', result.transactionHash);
      console.log('Block Number:', result.blockNumber);
      console.log('Amount:', result.rewardAmount, result.tokenSymbol);
      console.log('Employee Wallet:', result.employeeWallet);
      console.log('View on Etherscan:', `https://sepolia.etherscan.io/tx/${result.transactionHash}`);
      console.log('');
    } else {
      console.error('❌ Payment failed:', result.error || result.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ ERROR');
    console.error('='.repeat(60));
    console.error('Message:', error.message);
    console.error('Reason:', error.reason);
    console.error('Code:', error.code);
    console.error('');
    console.error('Full Error:', error);
    console.error('');
    
    // Check for common errors
    if (error.message.includes('wallet address not found')) {
      console.error('💡 Solution: Add wallet address to employee profile');
    } else if (error.message.includes('insufficient')) {
      console.error('💡 Solution: Check contract token balance');
    } else if (error.message.includes('Only Admin')) {
      console.error('💡 Solution: Check HR_PAYROLL_PRIVATE_KEY is admin');
    } else if (error.message.includes('gas') || error.message.includes('ETH')) {
      console.error('💡 Solution: Add Sepolia ETH to signer wallet');
    }
    
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Get arguments
const employeeDid = process.argv[2];
const amount = process.argv[3] ? parseFloat(process.argv[3]) : 10;

if (!employeeDid) {
  console.error('Usage: node scripts/test-payment-direct.js <employee_did> [amount]');
  console.error('Example: node scripts/test-payment-direct.js 01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c 10');
  process.exit(1);
}

testPayment(employeeDid, amount);

