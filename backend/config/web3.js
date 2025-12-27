const { ethers } = require('ethers');

// Web3 Configuration for Web3 HR Management System
const web3Config = {
  // Network Configuration
  networks: {
    // Local development network
    localhost: {
      provider: 'http://localhost:8545',
      chainId: 31337,
      name: 'Localhost'
    },
    // Sepolia testnet
    sepolia: {
      provider: 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
      chainId: 11155111,
      name: 'Sepolia Testnet'
    },
    // Mainnet (for production)
    mainnet: {
      provider: 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID',
      chainId: 1,
      name: 'Ethereum Mainnet'
    }
  },

  // Current network (change based on environment)
  currentNetwork: process.env.NODE_ENV === 'production' ? 'mainnet' : 'localhost',

  // Multi-network support
  supportedNetworks: {
    ethereum: {
      mainnet: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        provider: 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID',
        blockExplorer: 'https://etherscan.io'
      },
      sepolia: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
        provider: 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
        blockExplorer: 'https://sepolia.etherscan.io'
      }
    },
    polygon: {
      mainnet: {
        chainId: 137,
        name: 'Polygon Mainnet',
        provider: 'https://polygon-rpc.com',
        blockExplorer: 'https://polygonscan.com'
      },
      mumbai: {
        chainId: 80001,
        name: 'Polygon Mumbai',
        provider: 'https://rpc-mumbai.maticvigil.com',
        blockExplorer: 'https://mumbai.polygonscan.com'
      }
    },
    bsc: {
      mainnet: {
        chainId: 56,
        name: 'BSC Mainnet',
        provider: 'https://bsc-dataseed.binance.org',
        blockExplorer: 'https://bscscan.com'
      },
      testnet: {
        chainId: 97,
        name: 'BSC Testnet',
        provider: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        blockExplorer: 'https://testnet.bscscan.com'
      }
    }
  },

  // Contract Addresses (update with deployed contract addresses)
  contracts: {
    employeeRegistry: process.env.EMPLOYEE_REGISTRY_CONTRACT || '0x0000000000000000000000000000000000000000',
    kpiContract: process.env.KPI_CONTRACT || '0x0000000000000000000000000000000000000000',
    payrollContract: process.env.PAYROLL_CONTRACT || '0x0000000000000000000000000000000000000000',
    attendanceContract: process.env.ATTENDANCE_CONTRACT || '0x0000000000000000000000000000000000000000',
    qrAuthentication: process.env.QR_AUTH_CONTRACT || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    consentManagement: process.env.CONSENT_CONTRACT || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    kpiManagement: process.env.KPI_MANAGEMENT_CONTRACT || '0x0000000000000000000000000000000000000000'
  },

  // Contract ABIs
  abis: {
    qrAuthentication: [
      "function mintQRToken(address to, string memory qrCodeId, string memory employeeDid, string memory qrHash, uint256 expiryDate) external returns (uint256)",
      "function verifyQRToken(string memory qrCodeId, string memory qrHash, string memory employeeDid) external view returns (bool, uint256)",
      "function recordQRUsage(string memory qrCodeId) external",
      "function revokeQRToken(string memory qrCodeId) external",
      "function getQRToken(uint256 tokenId) external view returns (tuple(string qrCodeId, string employeeDid, string qrHash, uint256 issueDate, uint256 expiryDate, bool isActive, uint256 usageCount, uint256 lastUsed))",
      "function getEmployeeTokens(string memory employeeDid) external view returns (uint256[] memory)",
      "function isQRValid(string memory qrCodeId) external view returns (bool)",
      "function tokenURI(uint256 tokenId) external view returns (string memory)",
      "function ownerOf(uint256 tokenId) external view returns (address)",
      "function balanceOf(address owner) external view returns (uint256)"
    ],
    consentManagement: [
      "function giveConsent(string memory employeeDid, string memory consentType, string memory purpose, uint256 duration, string memory ipfsHash) external returns (uint256)",
      "function revokeConsent(uint256 consentId) external",
      "function isConsentValid(uint256 consentId) external view returns (bool)",
      "function hasActiveConsent(string memory employeeDid, string memory consentType) external view returns (bool)",
      "function getEmployeeConsents(string memory employeeDid) external view returns (uint256[] memory)",
      "function getWalletConsents(address walletAddress) external view returns (uint256[] memory)",
      "function getConsent(uint256 consentId) external view returns (tuple(uint256 consentId, string employeeDid, address walletAddress, string consentType, string purpose, uint256 issuedAt, uint256 expiresAt, bool isActive, string ipfsHash))"
    ],
    kpiManagement: [
      "function createKpiCriteria(string memory kpiId, string memory tenKpi, string memory moTa, string memory loaiKpi, string memory donViDo, uint256 trongSo, uint256 nguongDat, uint256 nguongXuatSac, string[] memory apDungChoChucVu, string memory chuKyDanhGia) external",
      "function updateKpiCriteria(string memory kpiId, string memory tenKpi, string memory moTa, string memory donViDo, uint256 trongSo, uint256 nguongDat, uint256 nguongXuatSac, string[] memory apDungChoChucVu, string memory chuKyDanhGia) external",
      "function deactivateKpiCriteria(string memory kpiId) external",
      "function createKpiEvaluation(string memory employeeDid, string memory kpiId, string memory kyDanhGia, uint256 ngayBatDau, uint256 ngayKetThuc, uint256 giaTriThucTe, string memory nguoiDanhGiaDid, string memory nhanXet) external returns (uint256)",
      "function updateKpiEvaluation(uint256 evaluationId, uint256 giaTriThucTe, string memory nhanXet, string memory trangThai) external",
      "function approveKpiEvaluation(uint256 evaluationId) external",
      "function getKpiCriteria(string memory kpiId) external view returns (tuple(string kpiId, string tenKpi, string moTa, string loaiKpi, string donViDo, uint256 trongSo, uint256 nguongDat, uint256 nguongXuatSac, string[] apDungChoChucVu, string chuKyDanhGia, bool isActive, uint256 createdAt))",
      "function getKpiEvaluation(uint256 evaluationId) external view returns (tuple(uint256 evaluationId, string employeeDid, string kpiId, string kyDanhGia, uint256 ngayBatDau, uint256 ngayKetThuc, uint256 giaTriThucTe, uint256 diemSo, string xepLoai, string nguoiDanhGiaDid, string nhanXet, string trangThai, uint256 createdAt, uint256 updatedAt))",
      "function getEmployeeEvaluations(string memory employeeDid) external view returns (uint256[] memory)",
      "function getKpiEvaluationsByCriteria(string memory kpiId) external view returns (uint256[] memory)",
      "function getEvaluationsByPeriod(string memory kyDanhGia) external view returns (uint256[] memory)",
      "function getEmployeeKpiSummary(string memory employeeDid, string memory kyDanhGia) external view returns (uint256 totalScore, uint256 evaluationCount, string overallRanking)",
      "function isKpiCriteriaActive(string memory kpiId) external view returns (bool)",
      "function getTotalKpiCriteria() external view returns (uint256)",
      "function getTotalEvaluations() external view returns (uint256)",
      "function grantEvaluatorRole(address account) external",
      "function grantEmployeeRole(address account) external"
    ]
  },

  // Wallet Configuration
  wallet: {
    privateKey: process.env.PRIVATE_KEY,
    mnemonic: process.env.MNEMONIC
  },

  // Gas Configuration
  gas: {
    limit: 3000000,
    price: ethers.parseUnits('20', 'gwei')
  },

  // IPFS Configuration
  ipfs: {
    gateway: process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
    apiKey: process.env.IPFS_API_KEY,
    secretKey: process.env.IPFS_SECRET_KEY
  }
};

// Initialize Web3 Provider
let provider;
let signer;

async function initializeWeb3() {
  try {
    const networkConfig = web3Config.networks[web3Config.currentNetwork];

    if (!networkConfig) {
      console.log(`Network ${web3Config.currentNetwork} not configured, using demo mode`);
      return { provider: null, signer: null };
    }

    // Initialize provider with timeout
    provider = new ethers.JsonRpcProvider(networkConfig.provider);

    // Test connection with timeout
    try {
      await provider.getNetwork();
    } catch (networkError) {
      console.log('Network connection failed, using demo mode:', networkError.message);
      provider = null;
      signer = null;
      return { provider: null, signer: null };
    }

    // Initialize signer if private key is available
    if (web3Config.wallet.privateKey) {
      signer = new ethers.Wallet(web3Config.wallet.privateKey, provider);
    } else if (web3Config.wallet.mnemonic) {
      signer = ethers.Wallet.fromPhrase(web3Config.wallet.mnemonic).connect(provider);
    } else {
      console.log('Demo mode: No wallet configured, using demo signatures');
      signer = null;
    }

    console.log(`Web3 initialized for network: ${networkConfig.name}`);
    return { provider, signer };
  } catch (error) {
    console.log('Web3 initialization failed, using demo mode:', error.message);
    provider = null;
    signer = null;
    return { provider: null, signer: null };
  }
}

// Get contract instance
function getContract(contractName, abi) {
  if (!provider) {
    initializeWeb3();
  }

  const contractAddress = web3Config.contracts[contractName];
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error(`Contract ${contractName} not deployed or address not configured`);
  }

  const contractAbi = abi || web3Config.abis[contractName];
  if (!contractAbi) {
    throw new Error(`ABI for contract ${contractName} not found`);
  }

  // Use signer if available, otherwise use provider (read-only)
  return new ethers.Contract(contractAddress, contractAbi, signer || provider);
}

// Get QR Authentication contract instance
function getQRAuthContract() {
  return getContract('qrAuthentication');
}

// Get Consent Management contract instance
function getConsentContract() {
  return getContract('consentManagement');
}

// Get KPI Management contract instance
function getKpiContract() {
  return getContract('kpiManagement');
}

// Utility functions
const web3Utils = {
  // Convert DID to bytes32
  didToBytes32: (did) => {
    return ethers.formatBytes32String(did);
  },

  // Convert bytes32 to DID
  bytes32ToDid: (bytes32) => {
    return ethers.parseBytes32String(bytes32);
  },

  // Verify wallet signature
  verifySignature: (message, signature, address) => {
    const messageHash = ethers.hashMessage(message);
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  },

  // Generate wallet address from DID (for demo purposes)
  generateAddressFromDid: (did) => {
    // This is a simplified version - in production, use proper DID resolution
    const hash = ethers.keccak256(ethers.toUtf8Bytes(did));
    return ethers.getAddress(ethers.hexDataSlice(hash, 12));
  },

  // Generate QR hash using cryptographic signing
  generateQRHash: (qrData) => {
    const dataString = JSON.stringify(qrData);
    const hash = ethers.keccak256(ethers.toUtf8Bytes(dataString));
    return hash;
  },

  // Sign QR data with wallet
  signQRData: async (qrData) => {
    if (!signer) {
      console.log('Demo mode: Using demo signature for QR data');
      // Return a demo signature for testing purposes
      const dataString = JSON.stringify(qrData);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(dataString));
      return `0x${hash.slice(2, 66)}`; // Return first 32 bytes as demo signature
    }

    const dataString = JSON.stringify(qrData);
    const signature = await signer.signMessage(dataString);
    return signature;
  },

  // Verify QR signature
  verifyQRSignature: (qrData, signature, expectedAddress) => {
    const dataString = JSON.stringify(qrData);
    const messageHash = ethers.hashMessage(dataString);
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  }
};

module.exports = {
  web3Config,
  initializeWeb3,
  getContract,
  getQRAuthContract,
  getConsentContract,
  getKpiContract,
  web3Utils,
  provider,
  signer
};
