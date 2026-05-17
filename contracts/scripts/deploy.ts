import { ethers, network, run } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

/// Deploy PaymentToken + PropertyFactory, mint an initial PaymentToken balance
/// to the deployer, write addresses to deployments.json (consumed by the frontend),
/// and verify on Etherscan when running on Sepolia.
///
/// Usage:
///   Local dry-run: npx hardhat run scripts/deploy.ts
///   Sepolia:       npx hardhat run scripts/deploy.ts --network sepolia
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("─────────────────────────────────────────────────────");
  console.log(`Network:  ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log("─────────────────────────────────────────────────────");

  if (network.name === "sepolia" && balance < ethers.parseEther("0.05")) {
    console.warn("WARNING: deployer balance < 0.05 ETH; deployment may fail.");
  }

  // ── 1. PaymentToken ────────────────────────────────────────────────
  const PaymentToken = await ethers.getContractFactory("PaymentToken");
  const paymentToken = await PaymentToken.deploy("RealtyUSD", "rUSD", deployer.address);
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  console.log(`PaymentToken    → ${paymentTokenAddress}`);

  // ── 2. PropertyFactory ─────────────────────────────────────────────
  const PropertyFactory = await ethers.getContractFactory("PropertyFactory");
  const factory = await PropertyFactory.deploy(paymentTokenAddress, deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`PropertyFactory → ${factoryAddress}`);

  // ── 3. Mint initial PaymentToken to deployer for the demo faucet ───
  const initialMint = ethers.parseEther("1000000"); // 1,000,000 rUSD
  const mintTx = await paymentToken.mint(deployer.address, initialMint);
  await mintTx.wait();
  console.log(`Minted ${ethers.formatEther(initialMint)} rUSD to deployer`);

  // ── 4. Persist addresses to deployments.json (frontend reads this) ─
  const deployments = {
    network: network.name,
    chainId: Number(network.config.chainId ?? 0),
    paymentToken: paymentTokenAddress,
    propertyFactory: factoryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const outFile = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(outFile, JSON.stringify(deployments, null, 2) + "\n");
  console.log(`Wrote ${outFile}`);

  // ── 5. Verify on Etherscan (Sepolia only, key required) ────────────
  if (network.name !== "sepolia") {
    console.log("Skipping Etherscan verification (not on Sepolia).");
    return;
  }
  if (!process.env.ETHERSCAN_API_KEY) {
    console.log("Skipping Etherscan verification (ETHERSCAN_API_KEY not set).");
    return;
  }

  console.log("Waiting 30s for Etherscan to index the deployment...");
  await new Promise((r) => setTimeout(r, 30_000));

  await safeVerify(paymentTokenAddress, ["RealtyUSD", "rUSD", deployer.address], "PaymentToken");
  await safeVerify(factoryAddress, [paymentTokenAddress, deployer.address], "PropertyFactory");
}

async function safeVerify(address: string, constructorArguments: unknown[], label: string) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`${label} verified on Etherscan`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`${label} already verified`);
    } else {
      console.error(`${label} verification failed: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
