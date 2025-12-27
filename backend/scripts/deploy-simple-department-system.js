const hre = require("hardhat");

/**
 * Deploy script cho hệ thống quản lý phòng ban Web3 (Simplified version cho demo)
 * Sử dụng TUSD token và localhost network
 * 
 * Deploy theo thứ tự:
 * 1. TestUSDT (TUSD) token
 * 2. SimpleTestManagement contract
 * 3. SimpleVotingManagement contract
 * 4. DepartmentManagement contract (với TUSD)
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy TUSD Token
  console.log("\n=== Deploying TestUSDT (TUSD) ===");
  const TestUSDT = await hre.ethers.getContractFactory("TestUSDT");
  const tusdToken = await TestUSDT.deploy();
  await tusdToken.waitForDeployment();
  const tusdTokenAddress = await tusdToken.getAddress();
  console.log("TUSD Token deployed to:", tusdTokenAddress);
  
  // Get token decimals
  const decimals = await tusdToken.decimals();
  console.log("TUSD Decimals:", decimals);
  
  // Check balance
  const deployerBalance = await tusdToken.balanceOf(deployer.address);
  console.log("Deployer TUSD balance:", hre.ethers.formatUnits(deployerBalance, decimals));

  // 2. Deploy SimpleTestManagement
  console.log("\n=== Deploying SimpleTestManagement ===");
  const SimpleTestManagement = await hre.ethers.getContractFactory("SimpleTestManagement");
  const testManagement = await SimpleTestManagement.deploy();
  await testManagement.waitForDeployment();
  const testManagementAddress = await testManagement.getAddress();
  console.log("SimpleTestManagement deployed to:", testManagementAddress);

  // 3. Deploy SimpleVotingManagement
  console.log("\n=== Deploying SimpleVotingManagement ===");
  const SimpleVotingManagement = await hre.ethers.getContractFactory("SimpleVotingManagement");
  const votingManagement = await SimpleVotingManagement.deploy();
  await votingManagement.waitForDeployment();
  const votingManagementAddress = await votingManagement.getAddress();
  console.log("SimpleVotingManagement deployed to:", votingManagementAddress);

  // 4. Deploy DepartmentManagement với TUSD
  // Join reward: 100 TUSD (100 * 10^18 với 18 decimals)
  const joinRewardAmount = hre.ethers.parseUnits("100", decimals);
  console.log("\n=== Deploying DepartmentManagement ===");
  console.log("Join reward amount:", hre.ethers.formatUnits(joinRewardAmount, decimals), "TUSD");
  
  const DepartmentManagement = await hre.ethers.getContractFactory("DepartmentManagement");
  const departmentManagement = await DepartmentManagement.deploy(
    tusdTokenAddress,
    joinRewardAmount
  );
  await departmentManagement.waitForDeployment();
  const departmentManagementAddress = await departmentManagement.getAddress();
  console.log("DepartmentManagement deployed to:", departmentManagementAddress);

  // 5. Nạp TUSD vào DepartmentManagement contract để thưởng nhân viên
  console.log("\n=== Depositing TUSD to DepartmentManagement ===");
  const depositAmount = hre.ethers.parseUnits("10000", decimals); // 10,000 TUSD
  console.log("Depositing:", hre.ethers.formatUnits(depositAmount, decimals), "TUSD");
  
  // Approve
  await tusdToken.approve(departmentManagementAddress, depositAmount);
  console.log("Approved TUSD transfer");
  
  // Deposit
  await departmentManagement.depositTUSD(depositAmount);
  console.log("Deposited TUSD to contract");
  
  // Check balance
  const contractBalance = await departmentManagement.getTUSDBalance();
  console.log("Contract TUSD balance:", hre.ethers.formatUnits(contractBalance, decimals), "TUSD");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      TUSDToken: tusdTokenAddress,
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
  const deploymentPath = "./deployment-simple-department-system.json";
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);

  console.log("\n=== Next Steps ===");
  console.log("1. Update .env file with contract addresses");
  console.log("2. Record test score using SimpleTestManagement.recordTestScore()");
  console.log("3. Create voting period using SimpleVotingManagement.createVotingPeriod()");
  console.log("4. Create department using DepartmentManagement.createDepartment()");
  console.log("5. Employees can join using DepartmentManagement.joinDepartment()");
  console.log("6. They will automatically receive", hre.ethers.formatUnits(joinRewardAmount, decimals), "TUSD as reward!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

