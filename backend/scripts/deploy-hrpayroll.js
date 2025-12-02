/**
 * Script to deploy HRPayroll contract with TestUSDT token
 * 
 * Usage:
 *   npm run deploy:hrpayroll          # Deploy to localhost
 *   npm run deploy:hrpayroll:sepolia   # Deploy to Sepolia
 */

const hre = require("hardhat");

async function main() {
  console.log("=".repeat(60));
  console.log("DEPLOYING HRPAYROLL CONTRACT");
  console.log("=".repeat(60));
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");

  // Step 1: Deploy TestUSDT token
  console.log("Step 1: Deploying TestUSDT token...");
  const TestUSDT = await hre.ethers.getContractFactory("TestUSDT");
  const testUSDT = await TestUSDT.deploy();
  await testUSDT.waitForDeployment();
  const tokenAddress = await testUSDT.getAddress();
  console.log("✓ TestUSDT deployed to:", tokenAddress);
  
  const tokenSymbol = await testUSDT.symbol();
  const tokenDecimals = await testUSDT.decimals();
  const deployerTokenBalance = await testUSDT.balanceOf(deployer.address);
  console.log(`✓ Token Symbol: ${tokenSymbol}`);
  console.log(`✓ Token Decimals: ${tokenDecimals}`);
  console.log(`✓ Deployer Token Balance: ${hre.ethers.formatUnits(deployerTokenBalance, tokenDecimals)} ${tokenSymbol}`);
  console.log("");

  // Step 2: Deploy HRPayroll contract
  console.log("Step 2: Deploying HRPayroll contract...");
  const HRPayroll = await hre.ethers.getContractFactory("HRPayroll");
  const hrPayroll = await HRPayroll.deploy(tokenAddress);
  await hrPayroll.waitForDeployment();
  const payrollAddress = await hrPayroll.getAddress();
  console.log("✓ HRPayroll deployed to:", payrollAddress);
  
  const contractAdmin = await hrPayroll.admin();
  const contractToken = await hrPayroll.paymentToken();
  console.log(`✓ Contract Admin: ${contractAdmin}`);
  console.log(`✓ Payment Token: ${contractToken}`);
  console.log("");

  // Step 3: Transfer tokens to contract (optional - for initial funding)
  console.log("Step 3: Transferring tokens to contract...");
  const transferAmount = hre.ethers.parseUnits("100000", tokenDecimals); // 100,000 tokens
  const tx = await testUSDT.transfer(payrollAddress, transferAmount);
  await tx.wait();
  console.log(`✓ Transferred ${hre.ethers.formatUnits(transferAmount, tokenDecimals)} ${tokenSymbol} to contract`);
  
  const contractTokenBalance = await testUSDT.balanceOf(payrollAddress);
  console.log(`✓ Contract Token Balance: ${hre.ethers.formatUnits(contractTokenBalance, tokenDecimals)} ${tokenSymbol}`);
  console.log("");

  // Summary
  console.log("=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("");
  console.log("TestUSDT Token:");
  console.log("  Address:", tokenAddress);
  console.log("  Symbol:", tokenSymbol);
  console.log("  Decimals:", tokenDecimals);
  console.log("");
  console.log("HRPayroll Contract:");
  console.log("  Address:", payrollAddress);
  console.log("  Admin:", contractAdmin);
  console.log("  Payment Token:", contractToken);
  console.log("  Token Balance:", hre.ethers.formatUnits(contractTokenBalance, tokenDecimals), tokenSymbol);
  console.log("");

  // Update .env file instructions
  console.log("=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Update your .env file with:");
  console.log(`   HR_PAYROLL_ADDRESS=${payrollAddress}`);
  console.log(`   TOKEN_ADDRESS=${tokenAddress}`);
  console.log("");
  console.log("2. Make sure HR_PAYROLL_PRIVATE_KEY in .env matches the admin address");
  console.log(`   Admin address: ${contractAdmin}`);
  console.log("");
  console.log("3. If admin address is different, update the contract admin:");
  console.log("   - Or use the deployer's private key as HR_PAYROLL_PRIVATE_KEY");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

