# PRODUCT — RWA Real-Estate Tokenization dApp

## Register

**product**. Design serves the product. The catalogue is a working transaction surface (connect wallet → approve → buy shares on Sepolia), not a marketing page. Brand character lives inside the product, not on a separate landing.

## Product purpose

A working prototype that tokenizes residential and commercial real estate into per-property ERC-20 fractional shares, settled in a custom platform currency (rUSD). One property, one contract, one mapping entry, real on-chain ownership. The frontend exists so a non-developer can see balances move and shares accumulate without reading Solidity.

## Users

Two audiences, both seeing the same UI inside a ~7-minute live demo.

**Primary — DAUST faculty grading the project (2026-05-18).** Looking for evidence of deliberate engineering decisions: which data lives on-chain vs off-chain, how slots were packed, why custom errors were chosen over `require`, how reentrancy is defended (CEI + transient storage), how gas was optimised. Their attention is on whether the UI *exposes* and *substantiates* those decisions — not on whether it looks like Coinbase.

**Secondary — fellow students and instructors using the live app.** Connect a Sepolia wallet, get minted some rUSD, buy shares of a property, watch the balance update. They need clarity on what's about to happen, what just happened, and what an action costs — not delight, not novelty.

There is no "consumer investor" persona. Compliance and KYC are explicitly out of scope.

## Tone

**Engineered. Specific. Quietly confident.** Reads like a well-typeset spec sheet, not a fintech pitch. Numbers are exact, not approximate. Labels are concrete, not aspirational ("listed 2026·05·12" beats "recently added"). Confidence comes from precision, not from hype words.

What this tone is not:
- Not enthusiastic ("Welcome! Discover amazing properties!")
- Not crypto-bro ("Tokenize ✨ the future of real estate")
- Not corporate-bank ("Premium institutional-grade")
- Not generic-product ("Browse our catalogue")

The voice is closer to: *architectural drawing legend* + *terminal status line* + *auction catalogue caption*.

## Strategic principles

1. **Make the engineering visible.** Property cards should expose `propertyId`, listed timestamp, share-contract address, on-chain status. Hover or expand reveals the IPFS CID. Not buried — surfaced as part of the aesthetic. The technical detail IS the design.
2. **The number is the hero.** Prices, share counts, percentages should be set with the same care a magazine sets a headline. Tabular figures, precise decimals, no rounding tricks. Numbers carry weight; words support them.
3. **Honesty over progress theater.** No fake loading states, no celebratory confetti, no "you're amazing" copy. A transaction either succeeded or it didn't. Show the Etherscan link, show the gas spent, show the new balance. The fact that it worked is itself the reward.
4. **One accent, used deliberately.** Restrained color strategy: paper-warm neutrals with a single saturated ink color reserved for active state, primary action, and the progress bar. Never decorative.
5. **No nested cards.** No card-on-card. Sections are separated by horizontal rules, generous whitespace, and changes in type scale — not by stacked boxes.

## Anti-references

Designs we should not look like:
- **Coinbase / Robinhood** — consumer-investor onboarding aesthetic, big friendly CTAs, retail-investor tone
- **OpenSea** — NFT marketplace card grid, gradient accents, dark-mode-by-default
- **Generic crypto SaaS** — dark slate `#0f1115` + electric blue `#4f7dff` + monospace numbers + neon-on-black. This is exactly what the current build is. We are leaving this trap.
- **Stripe / Linear product clones** — gray-on-white sidebar + table aesthetic. Too familiar.
- **AI-tool minimalism** — centered single-column, cream `#fafaf8`, big serif headline, "we strip away complexity" tone

## Reference aesthetic — architectural blueprint

Paper-warm background (`oklch(0.97 0.005 85)`), ink text (`oklch(0.20 0.005 250)`), one saturated accent reserved for action/active state (a deep technical-drawing blue, `oklch(0.45 0.12 245)`), one alarm color for delisted/sold-out states (a muted rust, `oklch(0.55 0.10 35)`).

Typography: a serious display sans for headings (Söhne, Inter Display, or Söhne-adjacent), a precise grotesk for body (Inter / IBM Plex Sans), and a monospaced family for addresses, IDs, and tabular figures (JetBrains Mono / IBM Plex Mono). Tabular-nums on every number.

Layout: an explicit 12-column grid visible in dev (and subtly visible in production as ruled lines at section breaks). Generous outer margins (≥80px on desktop). Section dividers are hairlines (`0.5px solid oklch(0.85 0.005 250)`), not boxes.

Motion: deliberate, slow, no bounce. State changes ease-out-quart on 240ms. Buttons settle into a pressed state, never "pop".

## Out of scope for this redesign (parking lot)

- Mobile-first responsiveness past viewport ≥768px (we keep tablet/desktop strong, phone gets a working linear stack — judges will demo on a laptop)
- Light/dark mode toggle (we commit to a single light, paper-warm theme — see strategic principle #4)
- Onboarding flow (no first-run experience; the demo starts in the catalogue with a connected wallet)
- Marketing landing page (no `/`-route hero or "about" content; the catalogue IS the landing)

---

_Inferred from DESIGN.md and project context, 2026-05-14. Replace with a `/impeccable teach` run if anything below doesn't ring true._
