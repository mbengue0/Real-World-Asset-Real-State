import { createConfig, http } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { CONFIG } from "./config";

/**
 * Two chains supported:
 *   - Sepolia (production target, Etherscan-verified contracts)
 *   - Hardhat localhost (development against `npx hardhat node` on :8545)
 *
 * `injected()` handles MetaMask and other browser-injected wallets.
 * For WalletConnect/Coinbase we would add their connectors here (skipped — extra setup).
 */
export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(CONFIG.sepoliaRpcUrl || undefined),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});
