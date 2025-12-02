const { ethers, network } = require("hardhat");
const path = require("path");
const mongoose = require("mongoose");
const HoSoNhanVien = require("../models/HoSoNhanVien");
const connectDB = require("../config/db");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function fetchAddressesFromDatabase() {
  console.log("Fetching wallet addresses from MongoDB Atlas...");
  await connectDB();

  const employees = await HoSoNhanVien.find(
    {
      walletAddress: { $exists: true, $ne: null, $ne: "" },
    },
    { walletAddress: 1, ho_ten: 1, employee_did: 1 }
  ).lean();

  const uniqueAddresses = [];
  const seen = new Set();

  employees.forEach((employee) => {
    const address = (employee.walletAddress || "").trim();
    if (!address) return;

    try {
      const checksumAddress = ethers.getAddress(address);
      if (!seen.has(checksumAddress)) {
        seen.add(checksumAddress);
        uniqueAddresses.push({
          address: checksumAddress,
          employee_did: employee.employee_did,
          ho_ten: employee.ho_ten || "N/A",
        });
      }
    } catch (error) {
      console.warn(`⚠️  Skipping invalid address for ${employee.employee_did}: ${address}`);
    }
  });

  if (!uniqueAddresses.length) {
    console.log("No valid wallet addresses found in database.");
  } else {
    console.log(`Found ${uniqueAddresses.length} wallet addresses in database.`);
  }

  return uniqueAddresses;
}

async function main() {
  let inputAddresses = process.env.IMPERSONATE_ACCOUNTS
    ? process.env.IMPERSONATE_ACCOUNTS.split(",").map((addr) => addr.trim()).filter(Boolean)
    : process.argv.slice(2);

  let addressesToUnlock = [];

  if (inputAddresses.length) {
    addressesToUnlock = inputAddresses.map((addr) => ({ address: addr }));
  } else {
    addressesToUnlock = await fetchAddressesFromDatabase();
  }

  if (!addressesToUnlock.length) {
    console.log("No addresses provided or found. Nothing to impersonate.");
    process.exit(0);
  }

  console.log("Impersonating accounts on Hardhat node...\n");

  const [funder] = await ethers.getSigners();
  console.log("Funder account:", funder.address);

  for (const entry of addressesToUnlock) {
    const originalAddress = entry.address;

    if (!/^0x[a-fA-F0-9]{40}$/.test(originalAddress)) {
      console.warn(`⚠️  Skipping invalid address: ${originalAddress}`);
      continue;
    }

    try {
      const checksumAddress = ethers.getAddress(originalAddress);
      console.log(`\n🔓 Impersonating ${checksumAddress}...`);
      if (entry.employee_did || entry.ho_ten) {
        console.log(`   ↳ Employee: ${entry.ho_ten || "N/A"} (${entry.employee_did || "Unknown DID"})`);
      }

      // Impersonate account
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [checksumAddress],
      });
      console.log("   ✓ Account impersonated");

      // Optionally fund the account with ETH
      const balance = await ethers.provider.getBalance(checksumAddress);
      if (balance === 0n) {
        const tx = await funder.sendTransaction({
          to: checksumAddress,
          value: ethers.parseEther("10"),
        });
        await tx.wait();
        console.log("   ✓ Funded account with 10 ETH");
      } else {
        console.log("   ℹ️  Account already has balance:", ethers.formatEther(balance), "ETH");
      }

      // Verify signer works
      const signer = await ethers.getSigner(checksumAddress);
      const signerBalance = await signer.provider.getBalance(signer.address);
      console.log("   ✓ Signer ready. Current balance:", ethers.formatEther(signerBalance), "ETH");
    } catch (error) {
      console.error(`   ✗ Failed to impersonate ${originalAddress}:`, error.message);
    }
  }

  console.log("\nDone! These accounts are now unlocked on Hardhat node.");
  console.log("Remember: you'll need to re-run this after restarting `npm run node`.");

  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close().catch(() => {});
    console.log("Closed MongoDB connection.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error impersonating accounts:", error);
    process.exit(1);
  });

