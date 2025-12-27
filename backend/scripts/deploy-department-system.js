const hre = require("hardhat");

/**
 * Deploy script cho hệ thống quản lý phòng ban Web3
 * Deploy theo thứ tự:
 * 1. TestManagement contract
 * 2. VotingManagement contract
 * 3. DepartmentManagement contract
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy TestManagement
  console.log("\n=== Deploying TestManagement ===");
  const TestManagement = await hre.ethers.getContractFactory("TestManagement");
  const testManagement = await TestManagement.deploy();
  await testManagement.waitForDeployment();
  const testManagementAddress = await testManagement.getAddress();
  console.log("TestManagement deployed to:", testManagementAddress);

  // 2. Deploy VotingManagement
  console.log("\n=== Deploying VotingManagement ===");
  const VotingManagement = await hre.ethers.getContractFactory("VotingManagement");
  const votingManagement = await VotingManagement.deploy();
  await votingManagement.waitForDeployment();
  const votingManagementAddress = await votingManagement.getAddress();
  console.log("VotingManagement deployed to:", votingManagementAddress);

  // 3. Deploy DepartmentManagement
  console.log("\n=== Deploying DepartmentManagement ===");
  const DepartmentManagement = await hre.ethers.getContractFactory("DepartmentManagement");
  const departmentManagement = await DepartmentManagement.deploy();
  await departmentManagement.waitForDeployment();
  const departmentManagementAddress = await departmentManagement.getAddress();
  console.log("DepartmentManagement deployed to:", departmentManagementAddress);

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      TestManagement: testManagementAddress,
      VotingManagement: votingManagementAddress,
      DepartmentManagement: departmentManagementAddress
    },
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const deploymentPath = "./deployment-department-system.json";
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);

  console.log("\n=== Next Steps ===");
  console.log("1. Update .env file with contract addresses");
  console.log("2. Create test for a department using TestManagement");
  console.log("3. Create voting period using VotingManagement");
  console.log("4. Create department using DepartmentManagement with test and voting addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

