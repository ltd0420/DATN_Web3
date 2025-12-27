const hre = require("hardhat");

/**
 * Deploy script cho hệ thống quản lý phòng ban Web3 lên Sepolia testnet
 * Sử dụng TUSD token đã có sẵn (TOKEN_ADDRESS từ .env)
 * 
 * Deploy theo thứ tự:
 * 1. SimpleTestManagement contract
 * 2. SimpleVotingManagement contract
 * 3. DepartmentManagement contract (với TUSD có sẵn)
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    throw new Error("Deployer account has no ETH. Please fund the account first.");
  }

  // Get TUSD token address from environment
  const TUSD_TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || process.env.TUSD_TOKEN_ADDRESS;
  if (!TUSD_TOKEN_ADDRESS) {
    throw new Error("TOKEN_ADDRESS or TUSD_TOKEN_ADDRESS not set in environment variables");
  }
  
  console.log("\n=== Using existing TUSD Token ===");
  console.log("TUSD Token address:", TUSD_TOKEN_ADDRESS);
  
  // Verify token contract exists
  const ERC20_ABI = [
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function balanceOf(address account) external view returns (uint256)"
  ];
  
  const tokenContract = new hre.ethers.Contract(TUSD_TOKEN_ADDRESS, ERC20_ABI, deployer);
  try {
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    const deployerBalance = await tokenContract.balanceOf(deployer.address);
    console.log("Token Symbol:", symbol);
    console.log("Token Decimals:", decimals);
    console.log("Deployer TUSD balance:", hre.ethers.formatUnits(deployerBalance, decimals));
  } catch (error) {
    throw new Error(`Failed to verify token contract at ${TUSD_TOKEN_ADDRESS}: ${error.message}`);
  }

  // 1. Deploy SimpleTestManagement
  console.log("\n=== Deploying SimpleTestManagement ===");
  const SimpleTestManagement = await hre.ethers.getContractFactory("SimpleTestManagement");
  const testManagement = await SimpleTestManagement.deploy();
  await testManagement.waitForDeployment();
  const testManagementAddress = await testManagement.getAddress();
  console.log("SimpleTestManagement deployed to:", testManagementAddress);

  // 2. Deploy SimpleVotingManagement
  console.log("\n=== Deploying SimpleVotingManagement ===");
  const SimpleVotingManagement = await hre.ethers.getContractFactory("SimpleVotingManagement");
  const votingManagement = await SimpleVotingManagement.deploy();
  await votingManagement.waitForDeployment();
  const votingManagementAddress = await votingManagement.getAddress();
  console.log("SimpleVotingManagement deployed to:", votingManagementAddress);

  // 3. Deploy DepartmentManagement với TUSD có sẵn
  // Join reward: 100 TUSD (100 * 10^decimals)
  const decimals = await tokenContract.decimals();
  const joinRewardAmount = hre.ethers.parseUnits("100", decimals);
  console.log("\n=== Deploying DepartmentManagement ===");
  console.log("Join reward amount:", hre.ethers.formatUnits(joinRewardAmount, decimals), "TUSD");
  
  const DepartmentManagement = await hre.ethers.getContractFactory("DepartmentManagement");
  const departmentManagement = await DepartmentManagement.deploy(
    TUSD_TOKEN_ADDRESS,
    joinRewardAmount
  );
  await departmentManagement.waitForDeployment();
  const departmentManagementAddress = await departmentManagement.getAddress();
  console.log("DepartmentManagement deployed to:", departmentManagementAddress);

  // 4. Nạp TUSD vào DepartmentManagement contract để thưởng nhân viên
  console.log("\n=== Depositing TUSD to DepartmentManagement ===");
  const depositAmount = hre.ethers.parseUnits("10000", decimals); // 10,000 TUSD
  console.log("Depositing:", hre.ethers.formatUnits(depositAmount, decimals), "TUSD");
  
  // Check if deployer has enough TUSD
  const deployerTUSDBalance = await tokenContract.balanceOf(deployer.address);
  if (deployerTUSDBalance < depositAmount) {
    console.warn(`Warning: Deployer only has ${hre.ethers.formatUnits(deployerTUSDBalance, decimals)} TUSD, but trying to deposit ${hre.ethers.formatUnits(depositAmount, decimals)} TUSD`);
    console.warn("Skipping deposit. You can deposit TUSD later using:");
    console.warn(`  tokenContract.approve("${departmentManagementAddress}", amount)`);
    console.warn(`  departmentManagement.depositTUSD(amount)`);
  } else {
    // Approve
    const approveTx = await tokenContract.approve(departmentManagementAddress, depositAmount);
    await approveTx.wait();
    console.log("Approved TUSD transfer");
    
    // Deposit
    const depositTx = await departmentManagement.depositTUSD(depositAmount);
    await depositTx.wait();
    console.log("Deposited TUSD to contract");
    
    // Check balance
    const contractBalance = await departmentManagement.getTUSDBalance();
    console.log("Contract TUSD balance:", hre.ethers.formatUnits(contractBalance, decimals), "TUSD");
  }

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      TUSDToken: TUSD_TOKEN_ADDRESS,
      SimpleTestManagement: testManagementAddress,
      SimpleVotingManagement: votingManagementAddress,
      DepartmentManagement: departmentManagementAddress
    },
    config: {
      joinRewardAmount: joinRewardAmount.toString(),
      joinRewardAmountFormatted: hre.ethers.formatUnits(joinRewardAmount, decimals) + " TUSD",
      tusdDecimals: decimals.toString()
    },
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const deploymentPath = "./deployment-department-sepolia.json";
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);

  console.log("\n=== Environment Variables to Add ===");
  console.log("Add these to your .env file:");
  console.log(`DEPARTMENT_MANAGEMENT_ADDRESS=${departmentManagementAddress}`);
  console.log(`SIMPLE_TEST_MANAGEMENT_ADDRESS=${testManagementAddress}`);
  console.log(`TUSD_TOKEN_ADDRESS=${TUSD_TOKEN_ADDRESS}`);
  console.log(`RPC_URL=${process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'}`);
  console.log(`DEPARTMENT_MANAGEMENT_PRIVATE_KEY=${process.env.DEPARTMENT_MANAGEMENT_PRIVATE_KEY || process.env.HR_PAYROLL_PRIVATE_KEY || 'YOUR_PRIVATE_KEY'}`);

  console.log("\n=== Next Steps ===");
  console.log("1. Update .env file with the addresses above");
  console.log("2. Restart backend server");
  console.log("3. Test creating a department");
  console.log("4. Employees can take tests and join departments");
  console.log("5. They will automatically receive", hre.ethers.formatUnits(joinRewardAmount, decimals), "TUSD as reward!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

