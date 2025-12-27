const { ethers, NonceManager } = require('ethers');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const payrollContractService = require('./payrollContractService');

// Attendance Payment Contract Address
const ATTENDANCE_PAYMENT_ADDRESS = process.env.ATTENDANCE_PAYMENT_ADDRESS || '';
const ATTENDANCE_PAYMENT_PRIVATE_KEY = process.env.ATTENDANCE_PAYMENT_PRIVATE_KEY || process.env.HR_PAYROLL_PRIVATE_KEY || '';
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || '';

// AttendancePayment Contract ABI
const ATTENDANCE_PAYMENT_ABI = [
  "function admin() external view returns (address)",
  "function paymentToken() external view returns (address)",
  "function payAttendance(string memory _employeeDid, address _employeeWallet, string memory _date, uint256 _hoursWorked, uint256 _amountInTokenUnits) external",
  "function checkPaymentStatus(string memory _employeeDid, string memory _date) external view returns (bool)",
  "function getContractBalance() external view returns (uint256)",
  "function MINIMUM_HOURS() external view returns (uint256)",
  "function HOURLY_RATE() external view returns (uint256)",
  "event AttendancePaid(string indexed employeeDid, address indexed employeeWallet, string date, uint256 hoursWorked, uint256 amountPaid, uint256 timestamp)"
];

// ERC20 Token ABI
const ERC20_ABI = [
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

// Initialize provider and signer
let provider;
let signer;
let nonceManager;
let attendanceContract;
let tokenContract;
let initializationAttempted = false;
let initializationError = null;

const DEFAULT_HOURLY_RATE = Number(process.env.ATTENDANCE_HOURLY_RATE || 2); // 2 USDT per hour
// Yêu cầu tối thiểu 5 giờ làm việc cho 1 ngày để được thanh toán lương chấm công
const DEFAULT_MINIMUM_HOURS = Number(
  process.env.ATTENDANCE_MINIMUM_HOURS === undefined
    ? 5 // Mặc định: 5 giờ nếu không cấu hình khác trong .env
    : process.env.ATTENDANCE_MINIMUM_HOURS
); // Minimum hours required (0 = disabled)

function hasAttendanceContractConfig() {
  return Boolean(ATTENDANCE_PAYMENT_ADDRESS && ATTENDANCE_PAYMENT_PRIVATE_KEY && TOKEN_ADDRESS);
}

async function ensureAttendanceServiceReady() {
  if (!hasAttendanceContractConfig()) {
    return false;
  }
  if (!attendanceContract || !tokenContract) {
    const initResult = await initializeAttendancePaymentService();
    if (!initResult) {
      return false;
    }
  }
  return true;
}

async function initializeAttendancePaymentService() {
  // Prevent multiple initialization attempts if already failed
  if (initializationAttempted && initializationError) {
    throw initializationError;
  }
  
  // If already initialized successfully, return
  if (provider && signer && attendanceContract) {
    return { provider, signer, contract: attendanceContract };
  }
  
  initializationAttempted = true;
  
  try {
    let rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
    
    // Skip initialization if RPC_URL is not set and we're not using localhost
    if (!process.env.RPC_URL && rpcUrl === 'http://localhost:8545') {
      console.warn('[initializeAttendancePaymentService] RPC_URL not set. Skipping blockchain initialization.');
      console.warn('[initializeAttendancePaymentService] Set RPC_URL in .env to enable blockchain features.');
      initializationError = new Error('RPC_URL not configured');
      throw initializationError;
    }
    
    console.log(`[initializeAttendancePaymentService] Connecting to RPC: ${rpcUrl}`);
    
    // Create provider - ethers v6 will auto-detect network
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test connection with timeout
    try {
      await Promise.race([
        provider.getNetwork(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC connection timeout')), 10000)
        )
      ]);
      console.log(`[initializeAttendancePaymentService] Successfully connected to RPC: ${rpcUrl}`);
    } catch (connectionError) {
      console.error(`[initializeAttendancePaymentService] Failed to connect to RPC: ${rpcUrl}`);
      console.error(`[initializeAttendancePaymentService] Error: ${connectionError.message}`);
      console.error(`[initializeAttendancePaymentService] Please check your RPC_URL in .env file or set it to a valid Sepolia RPC endpoint.`);
      initializationError = new Error(`Cannot connect to RPC endpoint: ${rpcUrl}. Please check your RPC_URL in .env file.`);
      throw initializationError;
    }
    
    if (!ATTENDANCE_PAYMENT_PRIVATE_KEY) {
      throw new Error('ATTENDANCE_PAYMENT_PRIVATE_KEY is not set');
    }
    
    const wallet = new ethers.Wallet(ATTENDANCE_PAYMENT_PRIVATE_KEY, provider);
    nonceManager = new NonceManager(wallet);
    signer = nonceManager;
    
    const walletAddress = await signer.getAddress();
    console.log(`[initializeAttendancePaymentService] Signer wallet: ${walletAddress}`);
    
    if (!ATTENDANCE_PAYMENT_ADDRESS) {
      throw new Error('ATTENDANCE_PAYMENT_ADDRESS is not set');
    }
    
    attendanceContract = new ethers.Contract(ATTENDANCE_PAYMENT_ADDRESS, ATTENDANCE_PAYMENT_ABI, signer);
    
    // Get token address from contract or use env variable
    let tokenAddr = TOKEN_ADDRESS;
    try {
      tokenAddr = await attendanceContract.paymentToken();
    } catch (err) {
      console.warn('[initializeAttendancePaymentService] Could not get token from contract, using env variable');
    }
    
    if (!tokenAddr || tokenAddr === ethers.ZeroAddress) {
      throw new Error('Token address not found');
    }
    
    tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    
    const tokenSymbol = await tokenContract.symbol();
    const tokenDecimals = await tokenContract.decimals();
    const contractBalance = await tokenContract.balanceOf(ATTENDANCE_PAYMENT_ADDRESS);
    
    console.log(`[initializeAttendancePaymentService] Token: ${tokenSymbol}, Decimals: ${tokenDecimals}`);
    console.log(`[initializeAttendancePaymentService] Contract token balance: ${ethers.formatUnits(contractBalance, tokenDecimals)} ${tokenSymbol}`);
    
    console.log('[initializeAttendancePaymentService] Attendance payment service initialized successfully');
    
    initializationError = null; // Clear error on success
    return { provider, signer, contract: attendanceContract };
  } catch (error) {
    console.error('[initializeAttendancePaymentService] Failed to initialize:', error.message);
    initializationError = error;
    // Don't throw - allow server to start even if blockchain is unavailable
    // The error will be thrown when someone tries to use the service
    return null;
  }
}

/**
 * Calculate payment amount based on hours worked
 * @param {number} hoursWorked - Total hours worked (e.g., 8.5)
 * @returns {Object} Payment calculation result
 */
async function calculateAttendancePayment(hoursWorked, customAmountUsdt) {
  try {
    const HOURLY_RATE = DEFAULT_HOURLY_RATE;
    const MINIMUM_HOURS = DEFAULT_MINIMUM_HOURS;

    // Check minimum hours requirement
    if (MINIMUM_HOURS > 0 && hoursWorked < MINIMUM_HOURS) {
      return {
        eligible: false,
        reason: `Minimum ${MINIMUM_HOURS} hours required. Worked: ${hoursWorked.toFixed(2)} hours`,
        hoursWorked,
        hourlyRate: HOURLY_RATE,
        usdtAmount: 0,
        tokenUnits: '0'
      };
    }
    
    // Calculate payment: hours * hourly_rate
    const usdtAmount = customAmountUsdt !== undefined ? customAmountUsdt : hoursWorked * HOURLY_RATE;
    
    // Get token decimals
    let tokenUnits;
    if (await ensureAttendanceServiceReady()) {
      const tokenDecimals = await tokenContract.decimals();
      tokenUnits = ethers.parseUnits(usdtAmount.toFixed(tokenDecimals), tokenDecimals);
    } else {
      // Fallback: assume 18 decimals for ERC20 token
      tokenUnits = ethers.parseUnits(usdtAmount.toFixed(6), 18);
    }
    
    return {
      eligible: true,
      hoursWorked,
      hourlyRate: HOURLY_RATE,
      usdtAmount,
      tokenUnits: tokenUnits.toString(),
      minimumHours: MINIMUM_HOURS
    };
  } catch (error) {
    console.error('[calculateAttendancePayment] Error:', error);
    throw error;
  }
}

/**
 * Pay attendance salary automatically when employee checks out
 * @param {string} employeeDid - Employee DID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} hoursWorked - Total hours worked
 * @returns {Object} Payment result
 */
async function payAttendanceSalary(employeeDid, date, hoursWorked, options = {}) {
  try {
    const serviceReady = await ensureAttendanceServiceReady();

    // Get employee wallet address
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    if (!employee || !employee.walletAddress) {
      throw new Error(`Employee wallet address not found for ${employeeDid}`);
    }
    
    const employeeWallet = ethers.getAddress(employee.walletAddress);
    
    // Check if already paid
    if (serviceReady) {
      const alreadyPaid = await attendanceContract.checkPaymentStatus(employeeDid, date);
      if (alreadyPaid) {
        return {
          success: false,
          message: 'Already paid for this date',
          alreadyPaid: true
        };
      }
    }
    
    // Calculate payment
    const paymentCalc = await calculateAttendancePayment(hoursWorked, options.customAmountUsdt);
    
    if (!paymentCalc.eligible) {
      return {
        success: false,
        message: paymentCalc.reason,
        eligible: false,
        hoursWorked
      };
    }
    
    if (!serviceReady) {
      console.warn('[payAttendanceSalary] Attendance contract not configured. Falling back to HR Payroll contract.');
      const fallbackTx = await payrollContractService.payTaskReward(
        employeeDid,
        paymentCalc.usdtAmount,
        `attendance-${date}`
      );

      return {
        success: true,
        transactionHash: fallbackTx.transactionHash,
        employeeWallet,
        hoursWorked,
        usdtAmount: paymentCalc.usdtAmount,
        tokenUnits: paymentCalc.tokenUnits,
        method: 'payrollFallback'
      };
    }

    // Check contract balance
    const contractBalance = await tokenContract.balanceOf(ATTENDANCE_PAYMENT_ADDRESS);
    if (contractBalance < paymentCalc.tokenUnits) {
      const tokenSymbol = await tokenContract.symbol();
      const tokenDecimals = await tokenContract.decimals();
      throw new Error(
        `Insufficient contract balance. Required: ${ethers.formatUnits(paymentCalc.tokenUnits, tokenDecimals)} ${tokenSymbol}, ` +
        `Available: ${ethers.formatUnits(contractBalance, tokenDecimals)} ${tokenSymbol}`
      );
    }
    
    // Convert hours to integer * 100 (e.g., 8.5 hours = 850)
    const hoursInInteger = Math.round(hoursWorked * 100);
    
    // Execute payment
    console.log(`[payAttendanceSalary] Processing payment for ${employeeDid} on ${date}`);
    console.log(`[payAttendanceSalary] Hours: ${hoursWorked}, Amount: ${paymentCalc.usdtAmount} USDT`);
    
    const tx = await attendanceContract.payAttendance(
      employeeDid,
      employeeWallet,
      date,
      hoursInInteger,
      paymentCalc.tokenUnits,
      { gasLimit: 300000 }
    );
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log(`[payAttendanceSalary] Payment successful. TX: ${receipt.hash}`);
    
    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      employeeWallet,
      hoursWorked,
      usdtAmount: paymentCalc.usdtAmount,
      tokenUnits: paymentCalc.tokenUnits,
      gasUsed: receipt.gasUsed.toString(),
      method: 'attendanceContract'
    };
  } catch (error) {
    console.error('[payAttendanceSalary] Error:', error);
    throw error;
  }
}

/**
 * Check payment status for a specific date
 */
async function checkPaymentStatus(employeeDid, date) {
  try {
    if (!(await ensureAttendanceServiceReady())) {
      return false;
    }
    
    const paid = await attendanceContract.checkPaymentStatus(employeeDid, date);
    return paid;
  } catch (error) {
    console.error('[checkPaymentStatus] Error:', error);
    return false;
  }
}

/**
 * Get contract balance
 */
async function getContractBalance() {
  try {
    if (!tokenContract) {
      await initializeAttendancePaymentService();
    }
    
    const balance = await tokenContract.balanceOf(ATTENDANCE_PAYMENT_ADDRESS);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    
    return {
      balance: ethers.formatUnits(balance, decimals),
      symbol,
      raw: balance.toString()
    };
  } catch (error) {
    console.error('[getContractBalance] Error:', error);
    throw error;
  }
}

module.exports = {
  initializeAttendancePaymentService,
  calculateAttendancePayment,
  payAttendanceSalary,
  checkPaymentStatus,
  getContractBalance,
  ATTENDANCE_PAYMENT_ADDRESS
};

