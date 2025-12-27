require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
        },
      },
      viaIR: true,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60000
    },
    sepolia: {
      url: process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPARTMENT_MANAGEMENT_PRIVATE_KEY || process.env.HR_PAYROLL_PRIVATE_KEY || process.env.PRIVATE_KEY ? [
        process.env.DEPARTMENT_MANAGEMENT_PRIVATE_KEY || process.env.HR_PAYROLL_PRIVATE_KEY || process.env.PRIVATE_KEY
      ] : []
    }
  }
};
