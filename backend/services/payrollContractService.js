const { ethers, NonceManager } = require('ethers');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const SmartContractLogs = require('../models/SmartContractLogs');

// HR Payroll Safe Address
const HR_PAYROLL_ADDRESS = process.env.HR_PAYROLL_ADDRESS || '0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E';
const HR_PAYROLL_PRIVATE_KEY = process.env.HR_PAYROLL_PRIVATE_KEY || 'f596f9e97e9b0d3e614cd8a65c9eda5e9c553a80d67656f4cc116db12ef95bef';
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || ''; // ERC20 Token address (TestUSDT)

// HRPayroll Contract ABI (sử dụng ERC20 token)
const PAYROLL_ABI = [
  "function admin() external view returns (address)",
  "function paymentToken() external view returns (address)",
  "function paySalary(string memory _employeeDid, address _employeeWallet, uint256 _amount) public",
  "event SalaryPaid(string employeeDid, address walletAddress, uint256 amount)"
];

// ERC20 Token ABI
const ERC20_ABI = [
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// Initialize provider and signer
let provider;
let signer;
let nonceManager;
let payrollContract;
let tokenContract;
let initializationAttempted = false;
let initializationError = null;

async function initializePayrollService() {
  // Prevent multiple initialization attempts if already failed
  if (initializationAttempted && initializationError) {
    throw initializationError;
  }
  
  // If already initialized successfully, return
  if (provider && signer && payrollContract) {
    return { provider, signer, contract: payrollContract };
  }
  
  initializationAttempted = true;
  
  try {
    // Use environment variable for RPC URL or default to localhost
    // Fallback to alternative Sepolia RPC if primary fails
    let rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
    
    // Skip initialization if RPC_URL is not set and we're not using localhost
    if (!process.env.RPC_URL && rpcUrl === 'http://localhost:8545') {
      console.warn('[initializePayrollService] RPC_URL not set. Skipping blockchain initialization.');
      console.warn('[initializePayrollService] Set RPC_URL in .env to enable blockchain features.');
      initializationError = new Error('RPC_URL not configured');
      throw initializationError;
    }
    
    // If using Sepolia and primary RPC fails, try alternatives
    const sepoliaRpcOptions = [
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co',
      'https://rpc2.sepolia.org',
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161' // Public Infura endpoint
    ];
    
    console.log(`[initializePayrollService] Connecting to RPC: ${rpcUrl}`);
    
    // Create provider with timeout to prevent infinite retry loop
    // In ethers.js v6, JsonRpcProvider(url, network, options)
    // Pass null for network to auto-detect, options as third parameter
    provider = new ethers.JsonRpcProvider(rpcUrl, null, {
      staticNetwork: null, // Let it auto-detect
      timeout: 10000 // 10 second timeout
    });
    
    // Test connection with timeout
    try {
      await Promise.race([
        provider.getNetwork(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC connection timeout')), 10000)
        )
      ]);
      console.log(`[initializePayrollService] Successfully connected to RPC: ${rpcUrl}`);
    } catch (connectionError) {
      console.error(`[initializePayrollService] Failed to connect to RPC: ${rpcUrl}`);
      console.error(`[initializePayrollService] Error: ${connectionError.message}`);
      console.error(`[initializePayrollService] Please check your RPC_URL in .env file or set it to a valid Sepolia RPC endpoint.`);
      initializationError = new Error(`Cannot connect to RPC endpoint: ${rpcUrl}. Please check your RPC_URL in .env file.`);
      throw initializationError;
    }
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(HR_PAYROLL_PRIVATE_KEY, provider);
    
    // Use NonceManager to prevent "already known" errors
    // NonceManager ensures sequential nonces and prevents conflicts
    // This prevents "already known" errors when multiple transactions are sent
    nonceManager = new NonceManager(wallet);
    signer = nonceManager;
    
    const walletAddress = await signer.getAddress();
    console.log(`[initializePayrollService] Signer wallet: ${walletAddress}`);
    
    // Check wallet balance
    const walletBalance = await provider.getBalance(walletAddress);
    console.log(`[initializePayrollService] Wallet balance: ${ethers.formatEther(walletBalance)} ETH`);
    
    // Initialize contract instance with nonce-managed signer
    payrollContract = new ethers.Contract(HR_PAYROLL_ADDRESS, PAYROLL_ABI, signer);
    
    // Verify contract is deployed and get token address
    try {
      const contractAdmin = await payrollContract.admin();
      console.log(`[initializePayrollService] Contract admin: ${contractAdmin}`);
      
      // Get token address from contract
      const tokenAddr = await payrollContract.paymentToken();
      console.log(`[initializePayrollService] Payment token address: ${tokenAddr}`);
      
      // Initialize token contract
      if (tokenAddr && tokenAddr !== ethers.ZeroAddress) {
        tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
        
        // Check token balance of contract
        const contractTokenBalance = await tokenContract.balanceOf(HR_PAYROLL_ADDRESS);
        const tokenDecimals = await tokenContract.decimals();
        const tokenSymbol = await tokenContract.symbol();
        const formattedBalance = ethers.formatUnits(contractTokenBalance, tokenDecimals);
        console.log(`[initializePayrollService] Contract token balance: ${formattedBalance} ${tokenSymbol}`);
        
        // Check signer token balance
        const signerTokenBalance = await tokenContract.balanceOf(walletAddress);
        const formattedSignerBalance = ethers.formatUnits(signerTokenBalance, tokenDecimals);
        console.log(`[initializePayrollService] Signer token balance: ${formattedSignerBalance} ${tokenSymbol}`);
      } else {
        console.warn(`[initializePayrollService] Token address not set in contract`);
      }
    } catch (contractError) {
      console.error(`[initializePayrollService] Warning: Could not read contract info. Contract may not be deployed at ${HR_PAYROLL_ADDRESS}`);
      console.error(`[initializePayrollService] Error:`, contractError.message);
    }
    
    console.log('[initializePayrollService] Payroll service initialized successfully');
    console.log('[initializePayrollService] HR Payroll Contract Address:', HR_PAYROLL_ADDRESS);
    
    initializationError = null; // Clear error on success
    return { provider, signer, contract: payrollContract };
  } catch (error) {
    console.error('[initializePayrollService] Failed to initialize payroll service:', error.message);
    initializationError = error;
    // Don't throw - allow server to start even if blockchain is unavailable
    // The error will be thrown when someone tries to use the service
    return null;
  }
}

// Calculate salary based on working hours (1 hour = 1 USDT)
async function calculateHourlySalary(employeeDid, totalHours) {
  try {
    // 1 hour = 1 USDT
    const hourlyRate = 1; // USDT per hour
    const salaryInUSDT = totalHours * hourlyRate;
    
    // Convert USDT to Wei (assuming 18 decimals for USDT)
    // For native ETH, we use ethers.parseEther
    // For USDT, we need to handle differently, but for now we'll use ETH equivalent
    const salaryInWei = ethers.parseEther(salaryInUSDT.toString());
    
    return {
      hours: totalHours,
      usdtAmount: salaryInUSDT,
      weiAmount: salaryInWei.toString(),
      hourlyRate
    };
  } catch (error) {
    console.error('Calculate hourly salary error:', error);
    throw error;
  }
}

// Record salary payment on blockchain (using HRPayroll contract)
async function recordSalaryOnChain(employeeDid, hours, period) {
  try {
    if (!payrollContract || !tokenContract) {
      await initializePayrollService();
    }
    
    // Get employee wallet address
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    if (!employee || !employee.walletAddress) {
      throw new Error(`Employee wallet address not found for ${employeeDid}`);
    }
    
    const employeeWallet = employee.walletAddress;
    
    // Calculate salary
    const salaryCalc = await calculateHourlySalary(employeeDid, hours);
    
    // Get token decimals
    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    
    // Convert USDT amount to token units
    const salaryInTokenUnits = ethers.parseUnits(salaryCalc.usdtAmount.toString(), tokenDecimals);
    
    // Check contract token balance
    const contractTokenBalance = await tokenContract.balanceOf(HR_PAYROLL_ADDRESS);
    if (contractTokenBalance < salaryInTokenUnits) {
      throw new Error(`Insufficient contract token balance. Required: ${ethers.formatUnits(salaryInTokenUnits, tokenDecimals)} ${tokenSymbol}, Available: ${ethers.formatUnits(contractTokenBalance, tokenDecimals)} ${tokenSymbol}`);
    }
    
    // Execute payment using HRPayroll contract
    const tx = await payrollContract.paySalary(
      employeeDid,
      employeeWallet,
      salaryInTokenUnits,
      { gasLimit: 300000 }
    );
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      salary: salaryCalc,
      employeeWallet
    };
  } catch (error) {
    console.error('Record salary on chain error:', error);
    throw error;
  }
}

// Get contract balance (Token balance, not ETH)
async function getContractBalance() {
  try {
    if (!payrollContract || !tokenContract) {
      await initializePayrollService();
    }
    
    const tokenBalance = await tokenContract.balanceOf(HR_PAYROLL_ADDRESS);
    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    
    return {
      balance: ethers.formatUnits(tokenBalance, tokenDecimals),
      symbol: tokenSymbol,
      raw: tokenBalance.toString()
    };
  } catch (error) {
    console.error('Get contract balance error:', error);
    throw error;
  }
}

// Check payment status (HRPayroll contract does not track payment status by period)
// This function always returns false as HRPayroll doesn't have isPaid() function
async function checkPaymentStatus(employeeDid, period) {
  try {
    // HRPayroll contract doesn't track payment status
    // Payment status should be tracked in database instead
    console.warn('[checkPaymentStatus] HRPayroll contract does not track payment status. Use database records instead.');
    return false;
  } catch (error) {
    console.error('Check payment status error:', error);
    return false;
  }
}

// Pay task reward to employee wallet via smart contract (ERC20 Token)
async function payTaskReward(employeeDid, rewardAmount, taskId) {
  try {
    console.log(`[payTaskReward] Starting payment process for task ${taskId}`);
    console.log(`[payTaskReward] Employee DID: ${employeeDid}, Reward: ${rewardAmount} USDT`);

    // Initialize contract if not already initialized
    if (!payrollContract || !tokenContract) {
      console.log('[payTaskReward] Initializing payroll service...');
      await initializePayrollService();
    }

    // Get employee wallet address
    console.log(`[payTaskReward] Looking up employee: ${employeeDid}`);
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    if (!employee) {
      throw new Error(`Employee not found: ${employeeDid}`);
    }
    if (!employee.walletAddress) {
      throw new Error(`Employee wallet address not found for ${employeeDid}. Please update employee profile with wallet address.`);
    }

    const employeeWallet = ethers.getAddress(employee.walletAddress); // Normalize address
    console.log(`[payTaskReward] Employee wallet: ${employeeWallet}`);

    // Validate reward amount
    if (!rewardAmount || rewardAmount <= 0) {
      console.warn(`[payTaskReward] Invalid reward amount: ${rewardAmount}`);
      return {
        success: false,
        message: 'No reward to pay or invalid amount',
        transactionHash: null
      };
    }

    // Get token decimals (usually 18 for USDT)
    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    console.log(`[payTaskReward] Token: ${tokenSymbol}, Decimals: ${tokenDecimals}`);

    // Convert USDT amount to token units (with decimals)
    const rewardInTokenUnits = ethers.parseUnits(rewardAmount.toString(), tokenDecimals);
    console.log(`[payTaskReward] Reward amount: ${rewardAmount} ${tokenSymbol}`);
    console.log(`[payTaskReward] Reward in token units: ${rewardInTokenUnits.toString()}`);

    // Check contract token balance (not ETH balance)
    console.log(`[payTaskReward] Checking contract token balance...`);
    const contractTokenBalance = await tokenContract.balanceOf(HR_PAYROLL_ADDRESS);
    console.log(`[payTaskReward] Contract token balance: ${ethers.formatUnits(contractTokenBalance, tokenDecimals)} ${tokenSymbol}`);
    console.log(`[payTaskReward] Required token amount: ${ethers.formatUnits(rewardInTokenUnits, tokenDecimals)} ${tokenSymbol}`);
    
    if (contractTokenBalance < rewardInTokenUnits) {
      const errorMsg = `Insufficient contract token balance. Required: ${ethers.formatUnits(rewardInTokenUnits, tokenDecimals)} ${tokenSymbol}, Available: ${ethers.formatUnits(contractTokenBalance, tokenDecimals)} ${tokenSymbol}. Please transfer tokens to contract address: ${HR_PAYROLL_ADDRESS}`;
      console.error(`[payTaskReward] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Check wallet balance for gas (still need ETH for gas fees)
    const walletAddress = await signer.getAddress();
    const walletBalance = await provider.getBalance(walletAddress);
    console.log(`[payTaskReward] Signer wallet ETH balance: ${ethers.formatEther(walletBalance)} ETH`);
    if (walletBalance < ethers.parseEther('0.001')) {
      console.warn(`[payTaskReward] Low signer wallet balance. May fail due to insufficient gas.`);
    }

    // Check for pending transactions to avoid nonce conflicts
    // Get current nonce from network (pending state includes pending transactions)
    const currentNonce = await provider.getTransactionCount(walletAddress, 'pending');
    const latestNonce = await provider.getTransactionCount(walletAddress, 'latest');
    console.log(`[payTaskReward] Current nonce (pending): ${currentNonce}, Latest nonce: ${latestNonce}`);
    
    // If there are pending transactions, wait a bit for them to be mined
    if (currentNonce > latestNonce) {
      const pendingCount = currentNonce - latestNonce;
      console.log(`[payTaskReward] Found ${pendingCount} pending transaction(s). Waiting for confirmation...`);
      
      // Wait for pending transactions to be mined (max 30 seconds)
      let waitTime = 0;
      const maxWaitTime = 30000; // 30 seconds
      const checkInterval = 2000; // Check every 2 seconds
      
      while (waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        const newLatestNonce = await provider.getTransactionCount(walletAddress, 'latest');
        if (newLatestNonce >= currentNonce) {
          console.log(`[payTaskReward] Pending transactions confirmed. Proceeding...`);
          break;
        }
      }
      
      // Reset nonce manager to reload nonce from network
      if (nonceManager) {
        nonceManager.reset();
        console.log(`[payTaskReward] NonceManager reset to reload nonce from network`);
      }
    }

    // Execute payment via smart contract with retry logic
    // New contract signature: paySalary(string memory _employeeDid, address _employeeWallet, uint256 _amount)
    console.log(`[payTaskReward] Executing payment transaction...`);
    console.log(`[payTaskReward] Calling: paySalary("${employeeDid}", "${employeeWallet}", ${rewardInTokenUnits.toString()})`);
    
    let tx;
    let receipt;
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Get fresh nonce before each attempt
        if (retryCount > 0) {
          console.log(`[payTaskReward] Retry attempt ${retryCount + 1}/${maxRetries}`);
          // Reset nonce manager to get fresh nonce
          if (nonceManager) {
            nonceManager.reset();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }
        
        tx = await payrollContract.paySalary(
          employeeDid,           // string memory _employeeDid
          employeeWallet,        // address _employeeWallet
          rewardInTokenUnits,    // uint256 _amount
          { gasLimit: 300000 }
        );
        console.log(`[payTaskReward] Transaction sent: ${tx.hash}`);
        console.log(`[payTaskReward] Waiting for confirmation...`);

        // Wait for transaction confirmation
        receipt = await tx.wait();
        console.log(`[payTaskReward] Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`[payTaskReward] Gas used: ${receipt.gasUsed.toString()}`);
        break; // Success, exit retry loop
      } catch (txError) {
        retryCount++;
        const errorMsg = txError.message || txError.reason || 'Unknown error';
        
        // Check if error is "already known" or nonce-related
        if (errorMsg.includes('already known') || errorMsg.includes('nonce') || errorMsg.includes('replacement')) {
          console.warn(`[payTaskReward] Nonce conflict detected: ${errorMsg}`);
          
          if (retryCount < maxRetries) {
            // Reset nonce manager and wait before retry
            if (nonceManager) {
              nonceManager.reset();
            }
            const waitTime = retryCount * 2000; // Exponential backoff: 2s, 4s, 6s
            console.log(`[payTaskReward] Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry
          } else {
            throw new Error(`Transaction failed after ${maxRetries} retries. Last error: ${errorMsg}`);
          }
        } else {
          // Non-nonce error, throw immediately
          throw txError;
        }
      }
    }
    
    if (!receipt) {
      throw new Error('Transaction failed: No receipt received after retries');
    }

    // Verify payment by checking employee token balance
    const employeeTokenBalance = await tokenContract.balanceOf(employeeWallet);
    console.log(`[payTaskReward] Employee token balance after payment: ${ethers.formatUnits(employeeTokenBalance, tokenDecimals)} ${tokenSymbol}`);

    // Log transaction to smart_contract_logs
    try {
      await SmartContractLogs.create({
        contract_address: HR_PAYROLL_ADDRESS,
        transaction_hash: receipt.hash,
        block_number: receipt.blockNumber,
        function_name: 'paySalary',
        parameters: {
          employeeDid: employeeDid,
          employeeWallet: employeeWallet,
          amount: rewardInTokenUnits.toString(),
          task_id: taskId || null // Lưu task_id để kiểm tra trùng lặp
        },
        gas_used: receipt.gasUsed.toString(),
        status: 'Success',
        employee_did: employeeDid,
        amount: rewardAmount,
        timestamp: new Date()
      });
      console.log(`[payTaskReward] Transaction logged to smart_contract_logs`);
    } catch (logError) {
      console.error(`[payTaskReward] Failed to log transaction:`, logError);
      // Don't throw - payment was successful, logging is secondary
    }

    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      rewardAmount: rewardAmount,
      rewardInTokenUnits: rewardInTokenUnits.toString(),
      tokenSymbol: tokenSymbol,
      employeeWallet,
      employeeDid,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    console.error('[payTaskReward] Error details:', {
      message: error.message,
      reason: error.reason,
      code: error.code,
      data: error.data,
      stack: error.stack
    });

    // Log failed transaction to smart_contract_logs
    try {
      await SmartContractLogs.create({
        contract_address: HR_PAYROLL_ADDRESS,
        transaction_hash: null,
        block_number: null,
        function_name: 'paySalary',
        parameters: {
          employeeDid: employeeDid,
          amount: rewardAmount
        },
        gas_used: null,
        status: 'Failed',
        employee_did: employeeDid,
        amount: rewardAmount,
        timestamp: new Date()
      });
    } catch (logError) {
      console.error(`[payTaskReward] Failed to log failed transaction:`, logError);
    }

    throw error;
  }
}

// Transfer tokens to contract (for testing or manual top-up)
// Note: Contract doesn't have deposit() function, so we transfer tokens directly
async function transferTokensToContract(amountTokens) {
  try {
    if (!payrollContract || !tokenContract) {
      await initializePayrollService();
    }

    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    const amountInTokenUnits = ethers.parseUnits(amountTokens.toString(), tokenDecimals);

    // Check signer token balance
    const walletAddress = await signer.getAddress();
    const signerTokenBalance = await tokenContract.balanceOf(walletAddress);
    
    if (signerTokenBalance < amountInTokenUnits) {
      throw new Error(`Insufficient token balance. Required: ${ethers.formatUnits(amountInTokenUnits, tokenDecimals)} ${tokenSymbol}, Available: ${ethers.formatUnits(signerTokenBalance, tokenDecimals)} ${tokenSymbol}`);
    }

    // Transfer tokens to contract
    const tx = await tokenContract.transfer(HR_PAYROLL_ADDRESS, amountInTokenUnits);
    const receipt = await tx.wait();

    console.log(`[transferTokensToContract] Transferred ${amountTokens} ${tokenSymbol} to contract`);
    console.log(`[transferTokensToContract] Transaction hash: ${receipt.hash}`);

    return {
      success: true,
      transactionHash: receipt.hash,
      amount: amountTokens,
      symbol: tokenSymbol
    };
  } catch (error) {
    console.error('[transferTokensToContract] Error:', error);
    throw error;
  }
}

// Alias for backward compatibility
async function depositToContract(amountTokens) {
  return await transferTokensToContract(amountTokens);
}

// Get detailed contract and wallet info
async function getContractInfo() {
  try {
    if (!payrollContract || !tokenContract) {
      const initResult = await initializePayrollService();
      if (!initResult) {
        throw new Error('Failed to initialize payroll service. Please check RPC_URL and blockchain configuration.');
      }
    }

    // Double check after initialization
    if (!payrollContract || !tokenContract || !signer || !provider) {
      throw new Error('Payroll service not properly initialized. Please check blockchain connection.');
    }

    const walletAddress = await signer.getAddress();
    const walletBalance = await provider.getBalance(walletAddress);
    
    // Get token info
    const tokenAddress = await payrollContract.paymentToken();
    const tokenBalance = await tokenContract.balanceOf(HR_PAYROLL_ADDRESS);
    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    const contractAdmin = await payrollContract.admin();

    return {
      contractAddress: HR_PAYROLL_ADDRESS,
      contractAdmin: contractAdmin,
      signerAddress: walletAddress,
      signerEthBalance: ethers.formatEther(walletBalance),
      tokenAddress: tokenAddress,
      tokenSymbol: tokenSymbol,
      contractTokenBalance: ethers.formatUnits(tokenBalance, tokenDecimals),
      contractTokenBalanceRaw: tokenBalance.toString(),
      rpcUrl: process.env.RPC_URL || 'http://localhost:8545'
    };
  } catch (error) {
    console.error('[getContractInfo] Error:', error);
    throw error;
  }
}

module.exports = {
  initializePayrollService,
  calculateHourlySalary,
  recordSalaryOnChain,
  getContractBalance,
  checkPaymentStatus,
  payTaskReward,
  depositToContract,
  transferTokensToContract,
  getContractInfo,
  HR_PAYROLL_ADDRESS
};

