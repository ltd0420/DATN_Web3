/**
 * Script to test automatic task payment functionality
 * This simulates the approval process and payment
 * 
 * Usage: node scripts/test-task-payment.js <task_id> <employee_did>
 * Example: node scripts/test-task-payment.js task_123 employee_did_456
 */

require('dotenv').config();
const mongoose = require('mongoose');
const CongViecGiao = require('../models/CongViecGiao');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const payrollContractService = require('../services/payrollContractService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/web3hr';

async function testTaskPayment(taskId, employeeDid) {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find task
    const task = await CongViecGiao.findOne({ task_id: taskId });
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('TASK PAYMENT TEST');
    console.log('='.repeat(60));
    console.log(`Task ID: ${task.task_id}`);
    console.log(`Task Name: ${task.ten_cong_viec}`);
    console.log(`Employee DID: ${task.nguoi_thuc_hien_did}`);
    console.log(`Status: ${task.trang_thai}`);
    console.log(`Difficulty: ${task.muc_do_kho}`);
    console.log(`Deadline: ${task.ngay_ket_thuc_du_kien}`);
    console.log('');

    // Find employee
    const employee = await HoSoNhanVien.findOne({ 
      employee_did: employeeDid || task.nguoi_thuc_hien_did 
    });
    if (!employee) {
      console.error(`Employee not found: ${employeeDid || task.nguoi_thuc_hien_did}`);
      process.exit(1);
    }

    if (!employee.walletAddress) {
      console.error(`Employee wallet address not found!`);
      console.error(`Please update employee profile with wallet address.`);
      process.exit(1);
    }

    console.log(`Employee: ${employee.ho_ten}`);
    console.log(`Employee Wallet: ${employee.walletAddress}`);
    console.log('');

    // Check contract info
    console.log('Checking contract status...');
    const contractInfo = await payrollContractService.getContractInfo();
    console.log(`Contract Address: ${contractInfo.contractAddress}`);
    console.log(`Contract Balance: ${contractInfo.contractBalance} ETH`);
    console.log(`Signer Balance: ${contractInfo.signerBalance} ETH`);
    console.log('');

    // Calculate reward
    const calculateTaskReward = (mucDoKho, ngayKetThucDuKien, ngayHoanThanhThucTe) => {
      const isOnTime = ngayHoanThanhThucTe && new Date(ngayHoanThanhThucTe) <= new Date(ngayKetThucDuKien);
      
      // Base reward (thưởng cơ bản)
      const baseReward = {
        'Dễ': 5,
        'Vừa': 15,
        'Khó': 20
      };

      // Thưởng thêm khi đúng hạn
      const onTimeBonus = {
        'Dễ': 3,
        'Vừa': 5,
        'Khó': 8
      };

      const baseRewardAmount = baseReward[mucDoKho] || baseReward['Vừa'];
      const bonusAmount = onTimeBonus[mucDoKho] || onTimeBonus['Vừa'];
      
      if (isOnTime) {
        // Đúng hạn: base reward + thưởng thêm
        return { tien_thuong: baseRewardAmount + bonusAmount, tien_phat: 0 };
      } else {
        // Quá hạn: phạt cố định -2 USDT
        return { tien_thuong: 0, tien_phat: 2 };
      }
    };

    const rewardInfo = calculateTaskReward(
      task.muc_do_kho || 'Vừa',
      task.ngay_ket_thuc_du_kien,
      new Date()
    );

    console.log('Reward Calculation:');
    console.log(`  Reward (if on time): ${rewardInfo.tien_thuong} USDT`);
    console.log(`  Penalty (if late): ${rewardInfo.tien_phat} USDT`);
    console.log('');

    if (rewardInfo.tien_thuong <= 0) {
      console.log('No reward to pay. Task may be late or no reward configured.');
      process.exit(0);
    }

    // Test payment
    console.log('='.repeat(60));
    console.log('TESTING AUTOMATIC PAYMENT');
    console.log('='.repeat(60));
    console.log(`Attempting to pay ${rewardInfo.tien_thuong} USDT to ${employee.walletAddress}`);
    console.log('');

    const paymentResult = await payrollContractService.payTaskReward(
      employee.employee_did,
      rewardInfo.tien_thuong,
      task.task_id
    );

    console.log('');
    console.log('='.repeat(60));
    console.log('PAYMENT RESULT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(paymentResult, null, 2));
    console.log('');

    if (paymentResult.success) {
      console.log('✅ PAYMENT SUCCESSFUL!');
      console.log(`Transaction Hash: ${paymentResult.transactionHash}`);
      console.log(`Block Number: ${paymentResult.blockNumber}`);
      console.log(`Amount: ${paymentResult.rewardAmount} USDT`);
      console.log(`Employee Wallet: ${paymentResult.employeeWallet}`);
    } else {
      console.log('❌ PAYMENT FAILED!');
      console.log(`Error: ${paymentResult.message || paymentResult.error}`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Get command line arguments
const taskId = process.argv[2];
const employeeDid = process.argv[3];

if (!taskId) {
  console.error('Usage: node scripts/test-task-payment.js <task_id> [employee_did]');
  process.exit(1);
}

testTaskPayment(taskId, employeeDid)
  .then(() => {
    console.log('Test completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

