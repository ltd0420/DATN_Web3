const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy QRAuthentication contract
  const QRAuthentication = await ethers.getContractFactory("QRAuthentication");
  const qrAuth = await QRAuthentication.deploy();
  await qrAuth.waitForDeployment();
  const qrAuthAddress = await qrAuth.getAddress();
  console.log("QRAuthentication deployed to:", qrAuthAddress);

  // Deploy ConsentManagement contract
  const ConsentManagement = await ethers.getContractFactory("ConsentManagement");
  const consent = await ConsentManagement.deploy();
  await consent.waitForDeployment();
  const consentAddress = await consent.getAddress();
  console.log("ConsentManagement deployed to:", consentAddress);

  // Deploy KpiManagement contract
  const KpiManagement = await ethers.getContractFactory("KpiManagement");
  const kpi = await KpiManagement.deploy();
  await kpi.waitForDeployment();
  const kpiAddress = await kpi.getAddress();
  console.log("KpiManagement deployed to:", kpiAddress);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    qrAuthentication: qrAuthAddress,
    consentManagement: consentAddress,
    kpiManagement: kpiAddress,
    network: network.name,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
