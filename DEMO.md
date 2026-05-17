# Live Demo Script — 5–7 minutes

> Use this with the slide deck (`SLIDES.md`). Each section maps to a specific grading criterion in `blockchain_lectures/Project_Presentation_Requirements.md`.

## Pre-demo checklist (run 10 minutes before)

- [ ] Sepolia ETH funded in deployer wallet (≥ 0.05 ETH)
- [ ] Sepolia ETH funded in buyer wallet (≥ 0.01 ETH for gas)
- [ ] Admin wallet has ≥ 5,000 rUSD; buyer wallet has ≥ 500 rUSD (run mint if not)
- [ ] One sample property pre-listed *(so the catalogue isn't empty when you load the page)*
- [ ] One sample property left **unlisted** — you'll list it live during the demo
- [ ] Browser tabs: dApp URL, Sepolia Etherscan tab on the factory address, GitHub repo tab, slide deck
- [ ] MetaMask: both wallets imported, screen sharing visible, on Sepolia network
- [ ] Backup screenshots of every step *(in case Sepolia is congested mid-demo)*

## 0:00–0:30 — Opening

> "We're presenting a dApp for fractional real-estate ownership in Senegal. The problem: real estate is illiquid and capital-intensive — most people in Dakar can't buy a property outright. The dApp lets multiple investors hold ERC-20 fractional shares of the same building, with ownership recorded on the Ethereum Sepolia testnet."

Switch to slide 2.

## 0:30–1:30 — Architecture (slide 3)

> "Three contracts. **`PaymentToken`** is our custom ERC-20 — the platform currency. **`PropertyFactory`** is the registry; the owner lists properties, and on each listing it **deploys a brand-new `PropertyShare` ERC-20** for that property. Owning N PropertyShare tokens means owning N/totalSupply of that specific property."

> "We chose this factory pattern over ERC-1155 because the brief asks for ERC-20 as *the project logic* — and here the asset itself is an ERC-20."

Cite: [COURSE — `Project_Presentation_Requirements.md:31`].

## 1:30–3:00 — Live: list a property (Admin tab)

1. Connect the **admin wallet** in MetaMask.
2. Click **Admin** tab — point out that this tab only appears because the connected wallet is the factory owner.
3. **Mint Form:** mint 5,000 rUSD to the buyer wallet address.
   - Show MetaMask popup. Confirm.
   - "This is the demo faucet. In production it would be removed — the owner mint is gated by `onlyOwner` from OpenZeppelin's `Ownable`."
4. **List Property Form:**
   - Upload an image of the property
   - "Behind this button, the frontend pins the image to IPFS via Pinata, then pins the JSON metadata that references the image CID, then calls `listProperty` with `ipfs://<metadata-CID>` as the URI."
   - Fill in name, location, totalShares = 100, pricePerShare = 10 rUSD
   - Submit. Watch the three-stage progress: pinning image → pinning JSON → submitting transaction.
   - Open Sepolia Etherscan tab → factory address → Internal Transactions → show the **`new PropertyShare`** contract creation. "The factory just deployed a brand-new ERC-20 in the same transaction."

Mention: [COURSE — Lab 15: ERC-20 via OpenZeppelin] [COURSE — Lecture_2.md:351-359 IPFS pinning].

## 3:00–5:00 — Live: buy shares

1. Switch MetaMask to the **buyer wallet**.
2. Click **Catalogue** → click the property card you just listed → property detail page loads.
   - "Notice the catalogue and detail page resolve IPFS metadata client-side. The image, location, description — all off-chain. Only the price, shares, and ownership state are on-chain."
3. In the **Buy form**: enter "5 shares". Total cost = 50 rUSD.
4. Click **Approve 50 rUSD** → confirm in MetaMask.
   - "Two-step ERC-20 flow: first approve, then transfer. This is the standard approval pattern."
5. Once approved, click **Buy 5 shares** → confirm.
6. Switch to Etherscan → show the transaction → click the **Logs** tab.
   - Point at the **`SharesPurchased`** event — propertyId and buyer are `indexed`.
   - "Events over storage. We don't keep purchase history on-chain — we emit events. Saves ~21,000 gas per purchase compared to writing to a storage array."

Cite: [COURSE — L10 technique 9: events over storage] [COURSE — L7: indexed event params].

## 5:00–6:00 — Dashboard

1. Click **Dashboard** tab.
2. Point at: PaymentToken balance (5,000 - 50 = 4,950 rUSD).
3. Point at: PropertyShare holdings — "5 of 100 shares · 5.00% ownership of the Saint-Louis Villa".
4. "If the buyer wanted to liquidate, they could transfer those PropertyShare tokens to anyone else via standard ERC-20 transfer — that's secondary-market resale for free, using existing wallet UX."

## 6:00–7:00 — Code & security highlights

Back to slides. Slide 5 (security) + Slide 6 (gas).

> "Three things to call out:"

1. **CEI pattern** in `buyShares()` — checks → state writes → external calls. Reference Lab 16's DAO incident.
2. **`ReentrancyGuardTransient`** — uses EIP-1153 transient storage. ~100 gas vs ~5,000 gas for the old storage-based lock.
3. **34 Hardhat tests passing** — claims the bonus. Tests cover every Lab 16 vulnerability scenario: reentrancy guard fires, custom errors decode, overflow reverts.

Cite: [COURSE — Lab 16] [COURSE — L10 technique 12].

## Q&A — anticipated questions

| Question | Short answer |
|----------|--------------|
| Why per-property ERC-20 instead of ERC-1155? | The brief asks for ERC-20 as the project logic; the asset itself becomes an ERC-20. ERC-1155 was option C in our design — gas-cheaper but the ERC-20 is auxiliary, not the asset. |
| What stops a malicious factory owner from listing a fake property? | Nothing on-chain. This is an instructor-curated platform model. Multi-issuer extension would be a `Roles`-based pattern (`AccessControl` from OZ), one modifier swap. |
| How is reentrancy actually prevented? | The `nonReentrant` modifier sets a transient slot at function entry, reverts on re-entry, and the slot is cleared automatically at end-of-transaction. EIP-1153, requires Cancun EVM. |
| Why is the metadata not on-chain? | `string` storage costs ~22,100 gas per slot. A property description is 200+ bytes. IPFS pinning is essentially free, and the CID is immutable — the only on-chain field needed is the URI pointer. |
| What about KYC / regulatory compliance? | Deliberately out of scope. The course covers technical primitives, not jurisdictional compliance. Production tokenization would use ERC-3643 (T-REX) with transfer hooks. |
| Tests? | `npx hardhat test` — 34 passing. Includes reentrancy guard verification, custom-error decoding, overflow scenarios, access control. |

## Timing — practice cuts

- If you're at 6:00 with Dashboard, **skip the Q&A anticipation** and let real questions drive.
- If you're at 4:30 with the buy, **skip the Etherscan deep-dive** and go straight to the dashboard.
- If MetaMask is laggy, **switch to the screenshots** — say *"on Sepolia mainnet timing, this completes in 12 seconds; for the demo, here's the confirmed state."*
