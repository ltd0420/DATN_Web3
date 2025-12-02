/**
 * Script to check Payroll Contract status and balance
 * Run: node scripts/check-payroll-contract.js
 */

require('dotenv').config();
const { ethers } = require('ethers');
const payrollContractService = require('../services/payrollContractService');

const HR_PAYROLL_ADDRESS = process.env.HR_PAYROLL_ADDRESS || '0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E';
const HR_PAYROLL_PRIVATE_KEY = process.env.HR_PAYROLL_PRIVATE_KEY || 'f596f9e97e9b0d3e614cd8a65c9eda5e9c553a80d67656f4cc116db12ef95bef';
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

async function checkPayrollContract() {
  try {
    console.log('='.repeat(60));
    console.log('PAYROLL CONTRACT STATUS CHECK');
    console.log('='.repeat(60));
    console.log('');

    // 1. Check RPC Connection
    console.log('1. Checking RPC Connection...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    console.log(`   ✓ Connected to: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   ✓ RPC URL: ${RPC_URL}`);
    console.log('');

    // 2. Check Signer Wallet
    console.log('2. Checking Signer Wallet...');
    const wallet = new ethers.Wallet(HR_PAYROLL_PRIVATE_KEY, provider);
    const walletAddress = await wallet.getAddress();
    const walletBalance = await provider.getBalance(walletAddress);
    console.log(`   ✓ Wallet Address: ${walletAddress}`);
    console.log(`   ✓ Wallet Balance: ${ethers.formatEther(walletBalance)} ETH`);
    if (walletBalance < ethers.parseEther('0.01')) {
      console.log(`   ⚠ WARNING: Low wallet balance! May not have enough gas for transactions.`);
    }
    console.log('');

    // 3. Check Contract
    console.log('3. Checking Contract...');
    console.log(`   Contract Address: ${HR_PAYROLL_ADDRESS}`);
    
    const contractCode = await provider.getCode(HR_PAYROLL_ADDRESS);
    if (contractCode === '0x') {
      console.log('   ✗ ERROR: Contract not deployed at this address!');
      console.log('   → Please deploy the HRPayroll contract first.');
      return;
    }
    console.log('   ✓ Contract is deployed');

    // 4. Check Contract Balance
    console.log('4. Checking Contract Balance...');
    try {
      const info = await payrollContractService.getContractInfo();
      console.log(`   ✓ Contract Admin: ${info.contractAdmin}`);
      console.log(`   ✓ Token Address: ${info.tokenAddress}`);
      console.log(`   ✓ Token Symbol: ${info.tokenSymbol}`);
      console.log(`   ✓ Contract Token Balance: ${info.contractTokenBalance} ${info.tokenSymbol}`);
      console.log(`   ✓ Signer ETH Balance: ${info.signerEthBalance} ETH`);
      
      if (parseFloat(info.contractTokenBalance) < 100) {
        console.log('   ⚠ WARNING: Contract token balance is low!');
        console.log(`   → To deposit tokens, use: POST /api/payroll/deposit with body: { "amount": 1000 }`);
        console.log(`   → Or transfer tokens directly to contract address: ${HR_PAYROLL_ADDRESS}`);
      }
    } catch (error) {
      console.log(`   ✗ ERROR: Could not read contract info: ${error.message}`);
    }
    console.log('');

    // 5. Test Contract Functions
    console.log('5. Testing Contract Functions...');
    try {
      await payrollContractService.initializePayrollService();
      console.log('   ✓ Contract initialized successfully');
      
      const balance = await payrollContractService.getContractBalance();
      console.log(`   ✓ getContractBalance() works: ${balance.balance} ${balance.symbol}`);
    } catch (error) {
      console.log(`   ✗ ERROR: Contract function test failed: ${error.message}`);
    }
    console.log('');

    // 6. Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('Contract Address:', HR_PAYROLL_ADDRESS);
    console.log('Signer Wallet:', walletAddress);
    console.log('Network:', network.name, `(Chain ID: ${network.chainId})`);
    console.log('');
    console.log('If payments are not working, check:');
    console.log('1. Contract has sufficient token balance (transfer tokens via /api/payroll/deposit)');
    console.log('2. Signer wallet has ETH for gas fees');
    console.log('3. Signer wallet has tokens to transfer to contract');
    console.log('4. RPC_URL in .env points to correct network');
    console.log('5. Contract address matches deployed HRPayroll contract');
    console.log('6. Token address is set correctly in contract');
    console.log('7. Employee has valid wallet address in profile');
    console.log('');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

checkPayrollContract()
  .then(() => {
    console.log('Check completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

