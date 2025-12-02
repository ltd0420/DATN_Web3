/**
 * Script để chuyển token từ signer wallet vào contract
 * 
 * Usage: node scripts/transfer-tokens-to-contract.js [amount]
 * Example: node scripts/transfer-tokens-to-contract.js 100000
 */

require('dotenv').config();
const { ethers } = require('ethers');
const payrollContractService = require('../services/payrollContractService');

async function transferTokens(amount = 100000) {
  try {
    console.log('='.repeat(60));
    console.log('TRANSFER TOKENS TO CONTRACT');
    console.log('='.repeat(60));
    console.log('');

    // Initialize service
    console.log('Initializing payroll service...');
    await payrollContractService.initializePayrollService();
    console.log('✅ Service initialized');
    console.log('');

    // Get contract info
    const contractInfo = await payrollContractService.getContractInfo();
    console.log('Contract Address:', contractInfo.contractAddress);
    console.log('Token Address:', contractInfo.tokenAddress);
    console.log('Token Symbol:', contractInfo.tokenSymbol);
    console.log('Current Contract Balance:', contractInfo.contractTokenBalance, contractInfo.tokenSymbol);
    console.log('');

    // Transfer tokens
    console.log(`Transferring ${amount} ${contractInfo.tokenSymbol} to contract...`);
    const result = await payrollContractService.transferTokensToContract(amount);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('TRANSFER SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('Transaction Hash:', result.transactionHash);
    console.log('Amount:', result.amount, result.symbol);
    console.log('View on Etherscan:', `https://sepolia.etherscan.io/tx/${result.transactionHash}`);
    console.log('');

    // Check new balance
    const newContractInfo = await payrollContractService.getContractInfo();
    console.log('New Contract Balance:', newContractInfo.contractTokenBalance, newContractInfo.tokenSymbol);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Get amount from command line or use default
const amount = process.argv[2] ? parseFloat(process.argv[2]) : 100000;

transferTokens(amount).then(() => {
  process.exit(0);
}).catch(error => {
  console.error(error);
  process.exit(1);
});

