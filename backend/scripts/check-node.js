const { ethers } = require("hardhat");

async function main() {
  console.log("Checking Hardhat node connection...\n");
  
  try {
    const provider = ethers.provider;
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    console.log("✓ Successfully connected to Hardhat node!");
    console.log("  Network:", network.name);
    console.log("  Chain ID:", network.chainId.toString());
    console.log("  Current Block:", blockNumber);
    console.log("  RPC URL:", provider.connection?.url || "http://127.0.0.1:8545");
    console.log("");
    
    // Get accounts
    const accounts = await ethers.getSigners();
    console.log(`✓ Found ${accounts.length} accounts`);
    console.log("  First account:", accounts[0].address);
    const balance = await provider.getBalance(accounts[0].address);
    console.log("  Balance:", ethers.formatEther(balance), "ETH");
    console.log("");
    
    console.log("Node is ready for deployment!");
    
  } catch (error) {
    console.error("✗ Cannot connect to Hardhat node");
    console.error("  Error:", error.message);
    console.error("");
    console.error("Please make sure:");
    console.error("  1. Hardhat node is running: npm run node");
    console.error("  2. Node is running on http://127.0.0.1:8545");
    console.error("  3. No firewall is blocking the connection");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

