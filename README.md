# Real World Asset Tokenization — Real Estate

> **DAUST · Spring 2026 · Blockchain & Web3 Introduction — Final Project**
> Submission: 2026-05-15 · Oral presentation: 2026-05-18

A decentralized application for **fractional ownership of real estate**, deployed on the Ethereum **Sepolia testnet**. Each property is represented by its own dedicated ERC-20 token; holding *N* tokens equals *N / totalSupply* ownership of that property. Purchases settle in a custom platform ERC-20 (`PaymentToken`).

| Submission item | Link |
|-----------------|------|
| GitHub repository | *this repo* |
| Live dApp | *https://real-world-asset-real-state.vercel.app/* |
| `PaymentToken` on Sepolia Etherscan | *https://sepolia.etherscan.io/address/0x06b0e4928420401c08eABbc26D77239B89a4e2B2 * |
| `PropertyFactory` on Sepolia Etherscan | *https://sepolia.etherscan.io/address/0x4251aD34bF6e7581279865EB96Fd8444fe532c3c * |

---

## Architecture — Option A, per-property ERC-20 factory

```
                    ┌─────────────────────────┐
                    │      PaymentToken       │  ← ERC-20 platform currency (rUSD, 18 decimals)
                    └─────────────────────────┘     Owner-only mint = demo faucet
                                 ▲
                                 │ approve → transferFrom (buyer → seller)
                                 │
       ┌─────────────────────►┌──┴───────────────────┐
       │                      │   PropertyFactory     │  ← single registry. Ownable + ReentrancyGuardTransient
       │                      │   listProperty()      │     CEI + custom errors + L10 gas patterns
       │                      │   buyShares()         │
       │                      │   delistProperty()    │
       │                      └────────────┬──────────┘
       │                                   │ `new PropertyShare(...)` per listing
       │                                   ▼
       │                ┌────────────────────────────┐
       │                │   PropertyShare (ERC-20)    │  ← fixed supply held by factory at construction
       │                │   decimals = 0              │     Transfers from factory to buyer
       │                │   immutable factory + id    │     on each buyShares() call
       │                └────────────────────────────┘
       │                                   ▲
       │                                   │ transfer (factory → buyer)
       │                                   │
       └───────────────────────────────────┘
```

See `DESIGN.md` for the on-chain / off-chain decision table, storage-slot packing layout, security choices, and full Lecture 10 technique mapping.

---

## Repo layout

```
.
├── contracts/              # Hardhat project — Solidity ^0.8.28, Cancun EVM target
│   ├── contracts/
│   │   ├── PaymentToken.sol
│   │   ├── PropertyFactory.sol
│   │   └── PropertyShare.sol
│   ├── test/               # 34 Hardhat tests (bonus criterion)
│   ├── scripts/
│   │   ├── deploy.ts       # Deploys + verifies on Sepolia
│   │   └── sync-abi.ts     # Extracts ABIs to frontend/src/abi/
│   └── hardhat.config.ts
├── frontend/               # Vite + React + TypeScript + wagmi v2 + viem
│   ├── src/
│   │   ├── abi/            # Auto-generated TS-typed ABIs (do not edit)
│   │   ├── components/     # Header, PropertyCard, BuyForm, MintForm, ListPropertyForm
│   │   ├── hooks/          # useProperties, useIpfsMetadata, useIsAdmin
│   │   ├── lib/            # ipfs, pinata, errors helpers
│   │   ├── pages/          # Catalogue, PropertyDetail, Dashboard, Admin
│   │   ├── App.tsx · main.tsx · config.ts · wagmi.ts
│   │   ├── App.css · index.css
│   ├── sample-metadata/    # Example IPFS JSON for 3 Senegalese properties
│   └── .env.example
├── DESIGN.md               # Tokenization design + Strategic Storage defense
├── DEMO.md                 # Live oral demo script — 5–7 minutes
├── SLIDES.md               # Slide deck outline (8 slides)
├── vercel.json             # Vercel monorepo config
├── .env.example            # Top-level secrets template (Sepolia, Etherscan, Pinata)
└── README.md               # this file
```

---

## Quick start — local development

Three terminals; see `DEMO.md` for the on-stage version of this.

### Terminal 1 — local blockchain
```powershell
cd contracts
npm install
npx hardhat node
```
This starts a Hardhat JSON-RPC node at `http://127.0.0.1:8545` (chain id `31337`) and prints 20 pre-funded test accounts with their private keys. Copy account `#0`'s private key — you'll import it into MetaMask in a moment.

### Terminal 2 — deploy + sync ABIs
```powershell
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```
Deploys `PaymentToken` and `PropertyFactory`, mints 1,000,000 rUSD to the deployer, and writes addresses to `contracts/deployments.json`.

Then create `frontend/.env` from the template and paste the two addresses:
```powershell
copy frontend\.env.example frontend\.env
# then edit frontend\.env:
#   VITE_CHAIN_ID=31337
#   VITE_PAYMENT_TOKEN_ADDRESS=<paymentToken from deployments.json>
#   VITE_PROPERTY_FACTORY_ADDRESS=<propertyFactory from deployments.json>
```

### Terminal 3 — frontend dev server
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

### MetaMask network setup
- Add network manually: **Hardhat**, RPC `http://127.0.0.1:8545`, chain id `31337`, currency `ETH`.
- Import account using account `#0`'s private key — this wallet is the factory owner, so the **Admin** tab becomes visible.

---

## Tests & gas report

```powershell
cd contracts
npx hardhat test                # 34 tests, all passing — bonus criterion
REPORT_GAS=true npx hardhat test  # adds the gas report at the end
```

Coverage:
- **PaymentToken (9 tests)** — deployment, owner-only mint, zero-address/zero-amount reverts, standard ERC-20 behaviour
- **PropertyFactory (25 tests)** — constructor validation, `listProperty` access + 4 input validations, `buyShares` happy path + 6 revert paths (sold-out, non-existent, oversupply, no approval, insufficient balance), status transitions, `delistProperty` access + idempotency

Vulnerability coverage:
- Reentrancy: `nonReentrant` modifier verified to fire (test case)
- Overflow: Solidity 0.8 guard verified (uint32 boundary)
- `tx.origin`: not used anywhere — verified by grep
- Unbounded loops: no loops over user-supplied input — verified by code review

---

## Deploy to Sepolia

Pre-requisites (one-time):
1. **Sepolia RPC URL** — sign up at [alchemy.com](https://alchemy.com) → create app → copy HTTPS URL
2. **Fresh deployer wallet** — new MetaMask account, export private key (no `0x` prefix)
3. **Sepolia ETH** — fund the deployer wallet via [Google Cloud faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) or [Alchemy faucet](https://www.alchemy.com/faucets/ethereum-sepolia) — minimum 0.05 ETH
4. **Etherscan API key** — free at [etherscan.io/myapikey](https://etherscan.io/myapikey)

Setup `.env`:
```powershell
copy .env.example contracts\.env
# edit contracts\.env with the four secrets above
```

Deploy + auto-verify:
```powershell
cd contracts
npx hardhat run scripts/deploy.ts --network sepolia
```

After deployment, copy the addresses from `contracts/deployments.json` into:
- `frontend/.env` (`VITE_PAYMENT_TOKEN_ADDRESS`, `VITE_PROPERTY_FACTORY_ADDRESS`, `VITE_CHAIN_ID=11155111`)
- This `README.md` (the table at the top)
- Vercel project env vars (Settings → Environment Variables)

---

## Deploy frontend to Vercel

1. Push the repo to GitHub
2. Connect the GitHub repo in the Vercel dashboard
3. Vercel auto-detects `vercel.json` — root directory `.`, build command builds the frontend, output `frontend/dist`
4. Set environment variables in the Vercel dashboard (mirror `frontend/.env`):
   - `VITE_CHAIN_ID=11155111`
   - `VITE_SEPOLIA_RPC_URL=<your Alchemy URL>`
   - `VITE_PAYMENT_TOKEN_ADDRESS=<from Sepolia deploy>`
   - `VITE_PROPERTY_FACTORY_ADDRESS=<from Sepolia deploy>`
   - `VITE_PINATA_JWT=<from Pinata>` (only needed for admin upload flow)
   - `VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/`
5. Deploy. The dApp URL is `https://real-world-asset-real-state.vercel.app/`.

---

## Tech stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Solidity | `^0.8.28` | Latest with Cancun EVM target for transient storage |
| Smart-contract framework | Hardhat | Standard EVM toolchain; integrated test runner, gas reporter, Etherscan verification |
| Security spine | OpenZeppelin v5.x | Audited `ERC20`, `Ownable`, `SafeERC20`, `ReentrancyGuardTransient` |
| Frontend bundler | Vite | Sub-second HMR, static output, zero-config Vercel deploy |
| Frontend framework | React + TypeScript | Industry standard, full type inference from `as const` ABIs |
| Web3 binding | wagmi v2 + viem | Modern type-safe successor to ethers v5; auto-generates types from ABIs |
| IPFS pinning | Pinata | Hosted pinning service; URI remains gateway-agnostic per IPFS spec |
| Network | Sepolia testnet | Brief requirement; Cancun-active since Jan 2024 |
| Hosting | Vercel | Free tier, zero-config for Vite builds, env vars in dashboard |


---

## License

MIT.
