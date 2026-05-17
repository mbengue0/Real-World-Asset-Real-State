# Design — RWA Real-Estate Tokenization

> This document is the artifact graders should read against the "Strategic Storage" and "Data Architecture" criteria in `Project_Presentation_Requirements.md:21-23`.
> Citations: `[COURSE — file]` refers to material in the course directory. `[EXTERNAL]` is outside-the-course knowledge approved by the instructor or required to satisfy a brief gap.

## 1. Problem statement

Tokenize residential/commercial real estate so that ownership of a single property can be split into ERC-20 fractional shares, traded peer-to-peer, and settled in a custom platform currency. Each property has its own ERC-20 contract; one share = one fractional unit of ownership; balances are real-time on the Sepolia testnet.

This is a course-scoped prototype. Compliance, KYC, jurisdiction, and legal-claim representation are **deliberately out of scope** — none of those topics appear in `blockchain_lectures/`.

## 2. Architecture (Option A — per-property ERC-20 factory)

```
┌────────────────┐   transferFrom    ┌────────────────────┐   deploys     ┌───────────────────┐
│  PaymentToken  │ ◄───────────────► │  PropertyFactory   │ ───────────► │  PropertyShare    │
│   (ERC-20)     │                   │   (registry)       │              │   (ERC-20, one    │
│                │                   │                    │              │    per property)  │
│  buyShares()   │   transferFrom    │  listProperty()    │   transfer   │                   │
│  approve()     │ ◄───────────────► │  buyShares()       │ ───────────► │  balanceOf(user)  │
└────────────────┘                   └────────────────────┘              └───────────────────┘
                                              ▲
                                              │ getProperty(id), totalProperties()
                                              │
                                          Frontend (wagmi reads/writes)
```

- **PaymentToken** — single ERC-20 acting as the platform currency. Extends OpenZeppelin `ERC20` + `Ownable`. Owner-only mint for the demo so testers can be issued balance without spending real ETH `[COURSE — Lab 15: OpenZeppelin patterns; L9: Ownable inheritance]`.
- **PropertyFactory** — single registry. Stores a `mapping(uint256 => Property)` indexed by `propertyId`, deploys a new `PropertyShare` instance per listed property, and handles the purchase flow (pull PaymentToken from buyer, transfer PropertyShare to buyer). Uses CEI + custom errors + `nonReentrant` `[COURSE — L8: CEI/custom errors; L9: composition; Lab 16: ReentrancyGuard]`.
- **PropertyShare** — minimal ERC-20 per property. Fixed supply minted to the factory at construction (factory then transfers to buyers). Two `immutable` value-type fields — `factory` (address) and `propertyId` (uint256) — set in the constructor and inlined into bytecode `[COURSE — L10: immutable saves ~2,100 gas/read]`. The metadata URI string lives only in the factory registry: Solidity does not support `immutable` for strings, so duplicating it here would waste a storage slot per property.

## 3. On-chain vs off-chain data — the Strategic Storage table

The brief grades "intentional selection of data stored on-chain vs. off-chain" `[COURSE — Project_Presentation_Requirements.md:22]`. Every field below is a deliberate decision.

| Field                       | Location           | Why                                                                                                            |
|-----------------------------|--------------------|----------------------------------------------------------------------------------------------------------------|
| `propertyId` (uint256)      | On-chain (factory) | Primary key. Must be deterministic and uniquely addressable from any contract `[COURSE — L7: mappings]`.       |
| `shareContract` (address)   | On-chain (factory) | The deployed `PropertyShare` address — anyone must be able to look it up to verify ownership.                   |
| `seller` (address)          | On-chain (factory) | Required at purchase time to route PaymentToken correctly. Cannot live off-chain — trust-sensitive.            |
| `pricePerShare` (uint128)   | On-chain (factory) | Read on every purchase; must be authoritative.                                                                 |
| `totalShares` (uint128)     | On-chain (factory) | Equals `PropertyShare.totalSupply()`; duplicated for cheap O(1) lookup without an external call.               |
| `sharesSold` (uint128)      | On-chain (factory) | Public progress indicator; needs to be incremented atomically with each purchase.                              |
| `status` (uint8 enum)       | On-chain (factory) | Listed / SoldOut / Delisted — drives access control on `buyShares()`.                                          |
| `metadataURI` (string)      | On-chain (factory) | IPFS pointer (`ipfs://<CID>`). Tiny string, written once at listing — see L2 IPFS rationale below.             |
| **Property name + location**| **Off-chain (IPFS metadata JSON)** | Variable-length strings — every byte of `string` storage costs gas. JSON on IPFS is essentially free.       |
| **Property description**    | **Off-chain (IPFS)** | Long text — would be prohibitively expensive on-chain.                                                       |
| **Property images**         | **Off-chain (IPFS)** | Binary blobs — impossible on-chain at any reasonable cost.                                                   |
| **Listing history**         | **Events (logs)**    | Read-only off-chain; emit events instead of writing to storage. Saves ~21,000 gas per record `[COURSE — L10 technique 9]`. |
| **User token balances**     | **PropertyShare contract** | ERC-20 standard mapping; cannot be off-chain — it's the asset itself.                                  |

### Off-chain JSON schema (pinned to IPFS via Pinata)
```json
{
  "name": "<property name>",
  "description": "<long description>",
  "location": { "address": "...", "city": "...", "country": "..." },
  "imageURI": "ipfs://<image-CID>",
  "yearBuilt": 0,
  "type": "residential | commercial",
  "areaSqM": 0
}
```
The factory only stores the parent `metadataURI`. The frontend resolves it through any IPFS gateway `[EXTERNAL — gap d.6; Pinata as pinning service maps to L2 IPFS]`.

## 4. Storage layout — slot packing

Per `[COURSE — L10 technique 2]`, the EVM packs consecutive variables ≤32 bytes into a single 32-byte slot. The `Property` struct in `PropertyFactory` is laid out to minimise slot count:

```solidity
struct Property {
    address shareContract;  // slot 0 — 20 bytes
    uint96  pricePerShare;  // slot 0 — 12 bytes (packed)         → 32 bytes used
    address seller;         // slot 1 — 20 bytes
    uint64  listedAt;       // slot 1 — 8 bytes  (packed)
    uint32  totalShares;    // slot 1 — 4 bytes  (packed)         → 32 bytes used
    uint32  sharesSold;     // slot 2 — 4 bytes
    uint8   status;         // slot 2 — 1 byte   (packed)
    // slot 2: 27 bytes free for future fields if we ever extend
    string  metadataURI;    // slot 3+ — dynamic (string occupies its own slot/region anyway)
}
```

**Slots per property: 3 fixed + dynamic string** instead of the naive 7+ fixed slots. At ~22,100 gas per cold SSTORE this saves roughly 80,000 gas per listing. Listing is rare; purchasing is hot — the cached-struct-to-memory pattern from `[COURSE — L10 technique 1]` is what actually pays off in `buyShares()`.

Trade-off acknowledged from `[COURSE — L10 final slide]`: packed structs are less readable. The struct is commented in-source.

## 5. Roles and access control

| Role         | Who                              | What they can do                                                |
|--------------|----------------------------------|-----------------------------------------------------------------|
| Factory owner| Deployer wallet                  | `listProperty()`, set seller for a property                     |
| Token owner  | PaymentToken deployer            | `mint()` PaymentToken (demo only — exposed as faucet for testing)|
| Investor     | Any wallet with PaymentToken     | `approve()` + `buyShares()` to acquire fractional ownership     |
| Shareholder  | Any wallet holding PropertyShare | Receive ERC-20 transfers; standard transfer/approve onward      |

Access control uses OpenZeppelin `Ownable` (`onlyOwner` modifier). Custom error: `error Unauthorized(address caller);` `[COURSE — L8: custom errors; L9: Ownable; Lab 16: never tx.origin]`.

## 6. Events

| Event                                                              | Emitter         | Frontend use case                              |
|--------------------------------------------------------------------|-----------------|------------------------------------------------|
| `PropertyListed(uint256 indexed id, address shareContract, address seller, uint256 totalShares, uint256 pricePerShare, string metadataURI)` | PropertyFactory | New listing appears in the catalogue           |
| `SharesPurchased(uint256 indexed propertyId, address indexed buyer, uint256 shares, uint256 paid)` | PropertyFactory | Live activity feed; refresh user holdings       |
| `PropertyDelisted(uint256 indexed id)`                            | PropertyFactory | Hide property from catalogue                   |
| `Transfer(address indexed from, address indexed to, uint256 value)` | PropertyShare + PaymentToken | Standard ERC-20 — wallets/explorers consume |

`indexed` parameters chosen to keep the 3-indexed-max limit `[COURSE — L7: events; max 3 indexed]`.

## 7. Custom errors (instead of `require` strings)

```solidity
error Unauthorized(address caller);
error InvalidShares(uint256 requested);
error InsufficientShareSupply(uint256 requested, uint256 available);
error InsufficientPayment(uint256 needed, uint256 approved);
error PropertyNotListed(uint256 propertyId);
error AlreadyDelisted(uint256 propertyId);
error ZeroAddress();
```

`[COURSE — L8 §5: custom errors save deployment + revert gas vs string require]` `[COURSE — L10 technique 8: same point quantified]`.

## 8. Security choices (defending against Lab 16's catalogue)

| Risk                          | Mitigation                                                                                        |
|-------------------------------|---------------------------------------------------------------------------------------------------|
| Reentrancy on `buyShares()`   | CEI: validate → update `sharesSold` → `transferFrom(PaymentToken)` → `transfer(PropertyShare)`. Wrapped in `nonReentrant` using transient storage `[COURSE — Lab 16 §1; L10 technique 12]`. |
| Integer overflow              | Solidity 0.8.28 reverts automatically `[COURSE — Lab 16 §2; L7 §7.3]`.                            |
| `tx.origin` authentication    | Not used anywhere — `Ownable` uses `msg.sender` `[COURSE — Lab 16 §3]`.                           |
| Unbounded loop DoS            | No loops over user-supplied arrays. Catalogue listed by `propertyId` from 1..`totalProperties()`; frontend paginates if needed `[COURSE — Lab 16 §4: pull-over-push]`. |
| Lost ETH on contract          | No `payable` fallbacks on factory; only ERC-20 PaymentToken used for value transfer.              |

## 9. Gas optimisations applied (mapped to L10 techniques)

| L10 Technique                              | Where applied                                                       |
|--------------------------------------------|---------------------------------------------------------------------|
| #1 Cache storage reads/structs to memory   | `buyShares()` loads `Property` struct to memory before reads        |
| #2 Storage variable packing                | `Property` struct laid out as 3 packed slots (see §4)               |
| #3 `constant` / `immutable`                | `PropertyShare`: immutable `factory`, `metadataURI`, `propertyId`   |
| #5 `calldata` over `memory` for inputs     | `listProperty()` takes `string calldata metadataURI`                |
| #6 `external` over `public`                | All user-facing entry points declared `external`                    |
| #7 `unchecked` in bounded loops            | If counter loops needed during deploy script — applied carefully    |
| #8 Custom errors over strings              | All revert paths use custom errors (see §7)                         |
| #9 Events over storage for history         | No on-chain purchase history array; only `SharesPurchased` events   |
| #11 Mappings over arrays for lookup        | `properties[id]` is a mapping, not an array                         |
| #12 Transient storage for reentrancy lock  | `bool transient private _locked;` (Cancun EVM target)               |

## 10. Deliberately cut scope

- **Secondary marketplace** for resale of `PropertyShare` tokens after initial sale. Holders can still transfer them peer-to-peer via the standard ERC-20 `transfer` — wallet UX, no UI build-out.
- **Dividend / rental income distribution**. Mechanism would be `pull-over-push` with each shareholder claiming. Not in scope for 3 days.
- **Multi-issuer access**. Only the factory owner can list. Extending to a role-based pattern is a one-modifier swap `[COURSE — L9: inheritance, Roles pattern]`.
- **Oracle pricing**. `pricePerShare` is set by the owner at listing. No Chainlink integration.
- **KYC / compliance gates on `transfer`**. Would require an ERC-3643-style hook. Not taught in course.

## 11. Open questions to revisit before deploy

- Should the factory hold the seller's PropertyShare inventory (custodial) or should `PropertyShare` mint directly to buyers on purchase? **Decision: factory holds inventory** — simpler ownership tracking, single source of truth, fewer attack vectors. Trade-off: factory must be trusted (it is — single owner).
- Decimals on `PaymentToken` and `PropertyShare`? **PaymentToken: 18 decimals** (standard, easy mental math). **PropertyShare: 0 decimals** — shares are whole units; you can't own 0.5 shares.

---

_Last updated: 2026-05-12. Authoritative spec for Step 3 (contract implementation)._
