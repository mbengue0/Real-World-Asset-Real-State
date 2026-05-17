import { run, network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Re-runs Etherscan verification against an already-deployed pair of contracts
 * recorded in deployments.json. Use when:
 *   - The deploy succeeded but auto-verify in deploy.ts failed (e.g. v1/v2 API migration)
 *   - You changed a constructor argument and want to overwrite the existing verification
 *
 *   npx hardhat run scripts/verify.ts --network sepolia
 *   # or:
 *   npm run verify:sepolia
 *
 * Constructor argument lists must match exactly what was passed to deploy.ts.
 */
async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.error(`deployments.json not found at ${deploymentsPath}`);
    console.error("Run `npm run deploy:sepolia` first.");
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8")) as {
    network: string;
    chainId: number;
    paymentToken: string;
    propertyFactory: string;
    deployer: string;
  };

  if (network.name !== d.network) {
    console.warn(
      `Warning: --network is "${network.name}" but deployments.json was written on "${d.network}". ` +
        `Make sure you are pointing at the same network.`
    );
  }

  console.log(`Verifying on ${network.name} (chainId ${network.config.chainId})`);
  console.log(`PaymentToken:    ${d.paymentToken}`);
  console.log(`PropertyFactory: ${d.propertyFactory}`);
  console.log("");

  await safeVerify(d.paymentToken, ["RealtyUSD", "rUSD", d.deployer], "PaymentToken");
  await safeVerify(d.propertyFactory, [d.paymentToken, d.deployer], "PropertyFactory");
}

async function safeVerify(address: string, constructorArguments: unknown[], label: string) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`✓ ${label} verified`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`✓ ${label} already verified`);
    } else {
      console.error(`✗ ${label} verification failed: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
