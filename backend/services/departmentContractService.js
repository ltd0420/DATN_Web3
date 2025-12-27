const { ethers, NonceManager } = require('ethers');

// Contract Addresses
const DEPARTMENT_MANAGEMENT_ADDRESS = process.env.DEPARTMENT_MANAGEMENT_ADDRESS || '';
const DEPARTMENT_MANAGEMENT_PRIVATE_KEY = process.env.DEPARTMENT_MANAGEMENT_PRIVATE_KEY || process.env.HR_PAYROLL_PRIVATE_KEY || '';
const SIMPLE_TEST_MANAGEMENT_ADDRESS = process.env.SIMPLE_TEST_MANAGEMENT_ADDRESS || '';
const TUSD_TOKEN_ADDRESS = process.env.TUSD_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS || '';

// DepartmentManagement Contract ABI (simplified - only functions we need)
const DEPARTMENT_MANAGEMENT_ABI = [
  "function createDepartment(string memory departmentId, string memory departmentName, bool requireTest, address testContractAddress, uint256 minTestScore, bool requireVoting, address votingContractAddress, uint256 minVotes, uint256 votingPeriod) external",
  "function joinDepartment(string memory departmentId, string memory employeeDid, address walletAddress) external",
  "function checkQualification(string memory departmentId, string memory employeeDid) external view returns (bool qualified, string memory method)",
  "function isMemberOfDepartment(string memory departmentId, string memory employeeDid) external view returns (bool)",
  "function getDepartmentConfig(string memory departmentId) external view returns (string memory departmentName, bool isActive, bool requireTest, address testContractAddress, uint256 minTestScore, bool requireVoting, address votingContractAddress, uint256 minVotes, uint256 votingPeriod)",
  "function getDepartmentMembers(string memory departmentId) external view returns (string[] memory employeeDids)",
  "function removeMember(string memory departmentId, string memory employeeDid, string memory reason) external",
  "function tusdToken() external view returns (address)",
  "function joinRewardAmount() external view returns (uint256)",
  "event DepartmentCreated(string indexed departmentId, string departmentName, bool requireTest, bool requireVoting)",
  "event EmployeeJoined(string indexed departmentId, string indexed employeeDid, address walletAddress, string qualificationMethod)",
  "event EmployeeRemoved(string indexed departmentId, string indexed employeeDid, string reason)"
];

// SimpleTestManagement Contract ABI
const SIMPLE_TEST_MANAGEMENT_ABI = [
  "function recordTestScore(string memory departmentId, string memory employeeDid, uint256 score) external",
  "function getTestScore(string memory employeeDid, string memory departmentId) external view returns (uint256 score, bool passed)",
  "function hasPassedTest(string memory employeeDid, string memory departmentId) external view returns (bool)",
  "function testScores(string memory, string memory) external view returns (uint256)",
  "function hasTakenTest(string memory, string memory) external view returns (bool)",
  "event TestScoreRecorded(string indexed departmentId, string indexed employeeDid, uint256 score)"
];

// ERC20 Token ABI
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address recipient, uint256 amount) external returns (bool)"
];

// Initialize provider and signer
let provider;
let signer;
let nonceManager;
let departmentContract;
let testContract;
let tokenContract;
let initializationAttempted = false;
let initializationError = null;

function hasDepartmentContractConfig() {
  return Boolean(
    DEPARTMENT_MANAGEMENT_ADDRESS && 
    DEPARTMENT_MANAGEMENT_PRIVATE_KEY && 
    SIMPLE_TEST_MANAGEMENT_ADDRESS
  );
}

async function ensureDepartmentServiceReady() {
  if (!hasDepartmentContractConfig()) {
    return false;
  }
  if (!departmentContract || !testContract) {
    const initResult = await initializeDepartmentContractService();
    if (!initResult) {
      return false;
    }
  }
  return true;
}

async function initializeDepartmentContractService() {
  // Prevent multiple initialization attempts if already failed
  if (initializationAttempted && initializationError) {
    throw initializationError;
  }
  
  // If already initialized successfully, return
  if (provider && signer && departmentContract && testContract) {
    return { provider, signer, departmentContract, testContract };
  }
  
  initializationAttempted = true;
  
  try {
    let rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
    
    // Skip initialization if RPC_URL is not set and we're not using localhost
    if (!process.env.RPC_URL && rpcUrl === 'http://localhost:8545') {
      console.warn('[initializeDepartmentContractService] RPC_URL not set. Skipping blockchain initialization.');
      console.warn('[initializeDepartmentContractService] Set RPC_URL in .env to enable blockchain features.');
      initializationError = new Error('RPC_URL not configured');
      throw initializationError;
    }
    
    console.log(`[initializeDepartmentContractService] Connecting to RPC: ${rpcUrl}`);
    
    // Create provider - ethers v6 will auto-detect network
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test connection
    try {
      await Promise.race([
        provider.getNetwork(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
      ]);
      console.log('[initializeDepartmentContractService] RPC connection successful');
    } catch (networkError) {
      console.error('[initializeDepartmentContractService] RPC connection failed:', networkError.message);
      initializationError = networkError;
      throw networkError;
    }
    
    // Create wallet and signer
    const wallet = new ethers.Wallet(DEPARTMENT_MANAGEMENT_PRIVATE_KEY, provider);
    nonceManager = new NonceManager(wallet);
    signer = nonceManager;
    
    const walletAddress = await signer.getAddress();
    console.log(`[initializeDepartmentContractService] Signer wallet: ${walletAddress}`);
    
    // Initialize contracts
    departmentContract = new ethers.Contract(DEPARTMENT_MANAGEMENT_ADDRESS, DEPARTMENT_MANAGEMENT_ABI, signer);
    testContract = new ethers.Contract(SIMPLE_TEST_MANAGEMENT_ADDRESS, SIMPLE_TEST_MANAGEMENT_ABI, signer);
    
    // Initialize token contract if address provided
    if (TUSD_TOKEN_ADDRESS) {
      tokenContract = new ethers.Contract(TUSD_TOKEN_ADDRESS, ERC20_ABI, provider);
      const tokenSymbol = await tokenContract.symbol();
      console.log(`[initializeDepartmentContractService] Token contract: ${tokenSymbol} at ${TUSD_TOKEN_ADDRESS}`);
    }
    
    // Verify contracts are deployed
    try {
      const testAddress = await departmentContract.tusdToken();
      console.log(`[initializeDepartmentContractService] DepartmentManagement contract verified at ${DEPARTMENT_MANAGEMENT_ADDRESS}`);
      console.log(`[initializeDepartmentContractService] TUSD token address: ${testAddress}`);
    } catch (error) {
      console.error(`[initializeDepartmentContractService] Warning: Could not verify contract. Contract may not be deployed at ${DEPARTMENT_MANAGEMENT_ADDRESS}`);
    }
    
    return { provider, signer, departmentContract, testContract, tokenContract };
  } catch (error) {
    console.error('[initializeDepartmentContractService] Initialization error:', error);
    initializationError = error;
    throw error;
  }
}

/**
 * Create a new department on blockchain
 */
async function createDepartmentOnChain(departmentData) {
  if (!await ensureDepartmentServiceReady()) {
    throw new Error('Department contract service not initialized. Check RPC_URL and contract addresses.');
  }
  
  try {
    const {
      departmentId,
      departmentName,
      requireTest,
      testContractAddress,
      minTestScore,
      requireVoting,
      votingContractAddress,
      minVotes,
      votingPeriod
    } = departmentData;
    
    // Convert addresses
    const testAddr = testContractAddress || SIMPLE_TEST_MANAGEMENT_ADDRESS;
    const votingAddr = votingContractAddress || ethers.ZeroAddress;
    
    console.log('[createDepartmentOnChain] Creating department:', {
      departmentId,
      departmentName,
      requireTest,
      minTestScore
    });
    
    const tx = await departmentContract.createDepartment(
      departmentId,
      departmentName,
      requireTest || false,
      requireTest ? testAddr : ethers.ZeroAddress,
      minTestScore || 70,
      requireVoting || false,
      requireVoting ? votingAddr : ethers.ZeroAddress,
      minVotes || 1,
      votingPeriod || 1
    );
    
    console.log('[createDepartmentOnChain] Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[createDepartmentOnChain] Transaction confirmed in block:', receipt.blockNumber);
    
    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('[createDepartmentOnChain] Error:', error);
    throw error;
  }
}

/**
 * Record test score on blockchain
 */
async function recordTestScoreOnChain(departmentId, employeeDid, score) {
  if (!await ensureDepartmentServiceReady()) {
    throw new Error('Department contract service not initialized. Check RPC_URL and contract addresses.');
  }
  
  try {
    console.log('[recordTestScoreOnChain] Recording score:', { departmentId, employeeDid, score });
    
    const tx = await testContract.recordTestScore(departmentId, employeeDid, score);
    console.log('[recordTestScoreOnChain] Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[recordTestScoreOnChain] Transaction confirmed in block:', receipt.blockNumber);
    
    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('[recordTestScoreOnChain] Error:', error);
    throw error;
  }
}

/**
 * Check qualification on blockchain
 */
async function checkQualificationOnChain(departmentId, employeeDid) {
  if (!await ensureDepartmentServiceReady()) {
    // Fallback to off-chain check if blockchain not available
    return null;
  }
  
  try {
    const [qualified, method] = await departmentContract.checkQualification(departmentId, employeeDid);
    return {
      qualified,
      method: method || null
    };
  } catch (error) {
    console.error('[checkQualificationOnChain] Error:', error);
    return null; // Return null to fallback to off-chain check
  }
}

/**
 * Join department on blockchain
 */
async function joinDepartmentOnChain(departmentId, employeeDid, walletAddress) {
  if (!await ensureDepartmentServiceReady()) {
    throw new Error('Department contract service not initialized. Check RPC_URL and contract addresses.');
  }
  
  try {
    // Normalize wallet address
    const employeeWallet = ethers.getAddress(walletAddress);
    
    console.log('[joinDepartmentOnChain] Joining department:', {
      departmentId,
      employeeDid,
      walletAddress: employeeWallet
    });
    
    const tx = await departmentContract.joinDepartment(departmentId, employeeDid, employeeWallet);
    console.log('[joinDepartmentOnChain] Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[joinDepartmentOnChain] Transaction confirmed in block:', receipt.blockNumber);
    
    // Check for events
    const joinEvent = receipt.logs.find(log => {
      try {
        const parsed = departmentContract.interface.parseLog(log);
        return parsed && parsed.name === 'EmployeeJoined';
      } catch {
        return false;
      }
    });
    
    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      event: joinEvent ? departmentContract.interface.parseLog(joinEvent) : null
    };
  } catch (error) {
    console.error('[joinDepartmentOnChain] Error:', error);
    throw error;
  }
}

/**
 * Check if employee is member on blockchain
 */
async function isMemberOnChain(departmentId, employeeDid) {
  if (!await ensureDepartmentServiceReady()) {
    return null; // Fallback to off-chain check
  }
  
  try {
    const isMember = await departmentContract.isMemberOfDepartment(departmentId, employeeDid);
    return isMember;
  } catch (error) {
    console.error('[isMemberOnChain] Error:', error);
    return null;
  }
}

/**
 * Get test score from blockchain
 */
async function getTestScoreOnChain(departmentId, employeeDid) {
  if (!await ensureDepartmentServiceReady()) {
    return null;
  }
  
  try {
    const [score, passed] = await testContract.getTestScore(employeeDid, departmentId);
    return {
      score: Number(score),
      passed
    };
  } catch (error) {
    console.error('[getTestScoreOnChain] Error:', error);
    return null;
  }
}

module.exports = {
  initializeDepartmentContractService,
  ensureDepartmentServiceReady,
  hasDepartmentContractConfig,
  createDepartmentOnChain,
  recordTestScoreOnChain,
  checkQualificationOnChain,
  joinDepartmentOnChain,
  isMemberOnChain,
  getTestScoreOnChain
};

