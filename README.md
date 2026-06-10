
# OmniCurve: A Unified Continuous Distribution Prediction Market Protocol on Arbitrum Stylus

**OmniCurve** is a novel prediction market protocol built on **Arbitrum Stylus** (Rust compiled to WASM). Instead of fragmenting liquidity across many separate binary "yes/no" pools, OmniCurve collapses all possible outcomes into a **single continuous liquidity curve** — an "omni-curve" — governed by a normal Gaussian probability density function. Our mission is to deliver a capital-efficient, mathematically precise, and demand-responsive platform for the future of prediction markets. This enables users stake value for the many different possible outcomes under a single pool, preventing the liquidity from being fragmented. 

The core of **OmniCurve** translates the continuous Gaussian distribution into a fully on-chain pricing engine using fixed-point WAD arithmetic, an Abramowitz & Stegun error function approximation, and an 18-term Taylor series exponential. It provides a superior alternative to fragmented binary pool designs, which require creating a separate liquidity pool for every strike price. Instead, the users of our markets can bet under the same pool for the strike price of their choide. All of this would have been very tough to implement in native solidity, but the complex mathematical model governing our protocol could be made live on chain for extremely low gas costs, thanks to the **Arbitrum Stylus** which allowed us to use **Rust** as the primary development language which made implementing all of that math so easy. 

## Addresses and the Transaction Hashes

`Factory deployed at:` [0xf6bfadc33c3c42755d9634defbfcc52b8b2d5e24](https://sepolia.arbiscan.io/address/0xf6bfadc33c3c42755d9634defbfcc52b8b2d5e24)

`AMM Implementation:` [0x0d08e6c457bfe0794b258e66c20a788cc8a8fa32](https://sepolia.arbiscan.io/address/0x0d08e6c457bfe0794b258e66c20a788cc8a8fa32)

`Router Implementation:` [0x98846991e02802b20bf947cfe11b4ac6ff463d9f](https://sepolia.arbiscan.io/address/0x98846991e02802b20bf947cfe11b4ac6ff463d9f)

`LP Token Implementation:` [0xce5ce25964af3c917ebca5c972abec94022b868a](https://sepolia.arbiscan.io/address/0xce5ce25964af3c917ebca5c972abec94022b868a) 

`Market #0 {ETH price @ 2026} AMM Proxy:` [0x9736E98CA898Bf69daA126e715Eb639D2DaBFb46](https://sepolia.arbiscan.io/address/0x9736E98CA898Bf69daA126e715Eb639D2DaBFb46)

`Market #0 {ETH price @ 2026} Router Proxy:` [0xA65b5453a177d3C34654Ec4Be60754d0aD7ec6A5](https://sepolia.arbiscan.io/address/0xA65b5453a177d3C34654Ec4Be60754d0aD7ec6A5)

`Market #0 {ETH price @ 2026} LP Token Proxy:` [0x731489Ab2A0029a22a95b5Ea3f72335b18D40CCf](https://sepolia.arbiscan.io/address/0x731489Ab2A0029a22a95b5Ea3f72335b18D40CCf)

## Table of Contents

<ol>
    <li><a href="#1-overview">Overview</a>
        <ul>
            <li><a href="#11-introduction">Introduction</a></li>
            <li><a href="#12-the-omnicurve-solution-continuous-gaussian-pricing">The OmniCurve Solution: Continuous Gaussian Pricing</a></li>
            <li><a href="#13-demand-responsive-curve-dynamics">Demand-Responsive Curve Dynamics</a></li>
            <li><a href="#14-settlement-against-reality">Settlement Against Reality</a></li>
            <li><a href="#15-amm-model-comparison">AMM Model Comparison</a></li>
            <li><a href="#16-conclusion">Conclusion</a></li>
        </ul>
    </li>
    </li>
    <li><a href="#2-architecture">Architecture</a>
        <ul>
            <li><a href="#21-high-level-workflow">High-Level Workflow</a></li>
            <li><a href="#22-contract-system-eip-1167-proxy-factory">Contract System: EIP-1167 Proxy Factory</a></li>
            <li><a href="#23-trade-execution-infrastructure">Trade Execution Infrastructure</a></li>
            <li><a href="#24-liquidity-provision-infrastructure">Liquidity Provision Infrastructure</a></li>
            <li><a href="#25-fee-distribution-infrastructure">Fee Distribution Infrastructure</a></li>
            <li><a href="#26-market-resolution-infrastructure">Market Resolution Infrastructure</a></li>
            <li><a href="#27-settlement-infrastructure">Settlement Infrastructure</a></li>
        </ul>
    </li>
    <li><a href="#3-features">Features</a></li>
    <li><a href="#4-technical-stack">Technical Stack</a></li>
    <li><a href="#5-getting-started">Getting Started</a>
        <ul>
            <li><a href="#51-prerequisites">Prerequisites</a></li>
            <li><a href="#52-installation">Installation</a></li>
            <li><a href="#53-building-contracts">Building Contracts</a></li>
            <li><a href="#54-running-the-backend">Running the Backend</a></li>
            <li><a href="#55-running-the-frontend">Running the Frontend</a></li>
        </ul>
    </li>
    <li><a href="#6-deployment">Deployment</a></li>
    <li><a href="#7-project-status">Project Status</a></li>
    <li><a href="#8-contributing">Contributing</a></li>
    <li><a href="#9-project-license">Project License</a></li>
    <li><a href="#10-references">References</a></li>
</ol>

---

## 1. Overview

**OmniCurve** is a prediction market protocol that replaces the traditional approach of creating many separate binary outcome pools for tracking the same numerical asset with a single, unified continuous liquidity curve derived from the Gaussian (normal) distribution, serving as the base of the distribution markets where people can stake on infinite outcomes. Built on **Arbitrum Stylus** using **Rust** compiled to **WASM**, it performs all pricing mathematics entirely on-chain using **fixed-point arithmetic**.

The platform provides a complete prediction market experience: market creation, continuous-strike trading, liquidity provision and real-time analytics (AMM, Router and LP Tokens)— all powered by a full-stack monorepo spanning smart contracts, a backend API with real-time WebSocket feeds, and a React frontend.

### What led to this project?

Prediction markets have entered popular consciousness in the wake of the 2024 US Presidential elections, but the technology is likely still in its infancy. Further development could be of benefit both to developers and to the public at large. More specifically, today's prediction markets generally allow participants to express probability distributions over discrete outcomes, but many questions of relevance to the real world involve continuous outcomes. It's true that a perp market could elicit the expected value of a continuous variable from the market, but sometimes we would like to know more -- for example, do we know for sure a given project will take 10 years exactly, or could it perhaps be anywhere between 2 and 20? Do we know that a given project will have 10,000 users exactly, or could it be anywhere between 2,000 and 20,000? These questions are important, and today's prediction markets don't allow us to answer them. 


### 1.1 Introduction

#### The problem we solve: 

Existing prediction market platforms like Polymarket create separate binary pools for each possible outcome: "Will ETH be worth $5k by the end of 2026? Yes/No", "Will ETH be worth $5.1k by the end of 2026? Yes/No", and so on. Each strike price needs its own pool, its own liquidity, and its own market makers. This design leads to:

- **Fragmented liquidity**: Capital is spread thinly across many isolated pools
- **Incomplete coverage**: Only a handful of discrete strike prices are offered
- **Inefficient capital deployment**: LPs must choose which specific pool to fund

#### The Nature of Continuous Outcomes

Many real-world prediction questions don't have binary answers — they have a continuous range of possible outcomes. "What will ETH be worth at the end of 2026?" could be $500, $3,000, $10,000, or any value in between. "In what year will OpenAI release it's new model?" could be 2026, 2027, 2028, or any integer value in between. Forcing this continuous outcome space into discrete yes/no buckets is an artificial constraint that wastes capital and limits expressiveness.

#### Many markets tracking a single 

Traditional prediction markets suffer from a fundamental structural inefficiency. Consider a market on ETH's future price:

| Approach | Pools Required | Liquidity per Pool | Coverage |
|----------|---------------|-------------------|----------|
| Currently In markets | N separate pools (one per strike) | Total capital / N | Discrete strikes only |
| **OmniCurve** | **1 unified pool** | **Total capital** | **Any strike price** |

With N separate pools, each pool receives only a fraction of the total liquidity. Traders at less popular strike prices face thin order books, wide spreads, and high slippage. Market makers must actively manage positions across many pools simultaneously.

### 1.2 The OmniCurve Solution: Continuous Gaussian Pricing

OmniCurve replaces discrete pools with a **single continuous Gaussian curve**. The probability of any outcome is derived from the cumulative distribution function (CDF) of a normal distribution:

$$P_{\text{YES}}(x) = 1 - \Phi\left(\frac{x - \mu}{\sigma}\right)$$

$$P_{\text{NO}}(x) = \Phi\left(\frac{x - \mu}{\sigma}\right)$$

Where:
- $x$ is the trader's chosen strike price (any continuous value)
- $\mu$ (mu) is the market's expected value — the consensus belief of all participants
- $\sigma$ (sigma) is the market's uncertainty — how spread out beliefs are
- $\Phi$ is the cumulative distribution function of the standard normal distribution

**Economic intuition:** A YES position at strike $x$ is a bet that the final outcome will be *at or above* $x$. The further $x$ is above the current consensus $\mu$, the less likely this is, and the cheaper the YES token becomes (lower $P_{\text{YES}}$). Conversely, NO tokens become cheaper as $x$ falls further below $\mu$.

#### On-Chain Gaussian Mathematics

The Gaussian CDF is computed entirely on-chain using fixed-point WAD arithmetic (18-decimal precision). The mathematical stack consists of:

- **WAD arithmetic**: `wad_mul(a, b) = a * b / 1e18`, `wad_div(a, b) = a * 1e18 / b`
- **Error function**: Abramowitz & Stegun 5-coefficient polynomial approximation (max error ~1.5 x 10^-7):

$$\text{erf}(x) \approx 1 - (a_1 t + a_2 t^2 + a_3 t^3 + a_4 t^4 + a_5 t^5) e^{-x^2}, \quad t = \frac{1}{1 + px}$$

- **Exponential**: 18-term Taylor series expansion, clamped to [-20, +20] WAD:

$$e^x = \sum_{n=0}^{18} \frac{x^n}{n!}$$

- **Square root**: Newton's method with 128-iteration convergence
- **Gaussian CDF**: Composed from the above primitives as:

$$\Phi(z) = \frac{1}{2}\left(1 + \text{erf}\left(\frac{z}{\sqrt{2}}\right)\right)$$

All functions use I256 (signed 256-bit integer) with 18-decimal fixed-point representation, providing ~11 significant digits of precision.

### 1.3 Demand-Responsive Curve Dynamics

A critical innovation of OmniCurve is that **bettors move the curve, liquidity providers do not**.

The parameters $\mu$ and $\sigma$ are not static — they are a **stake-weighted distribution of all strike prices** bet by traders:

$$\mu = \frac{\sum w_i \cdot x_i}{\sum w_i} \qquad \sigma = \sqrt{\frac{\sum w_i \cdot x_i^2}{\sum w_i} - \mu^2}$$

Where each bet contributes weight $w_i$ (= its net stake in USDC) at strike $x_i$.

This is maintained on-chain via three running accumulators updated on every trade:

| Accumulator | Formula | Purpose |
|:------------|:--------|:--------|
| `acc_stake_weight` | $\sum w_i$ | Total conviction weight |
| `acc_weighted_x` | $\sum w_i \cdot x_i$ | Weighted strike sum (for $\mu$) |
| `acc_weighted_x_sq` | $\sum w_i \cdot x_i^2$ | Weighted strike-squared sum (for $\sigma$) |

**Why LPs cannot move the curve:** Liquidity providers are pure collateral underwriters. If LP deposits could shift $\mu$ and $\sigma$, they would be a free manipulation lever — someone could move the curve without taking any directional risk. By restricting curve movement to bettors who put capital at risk on a position, the protocol is manipulation-resistant by construction.

**The prior weight mechanism:** The market owner seeds an initial $\mu$ and $\sigma$ (a prior belief). This seed is backed by a configurable `prior_weight` of virtual stake (default: 100 WAD), so the first real bet cannot swing the curve to a single point. As more bets accumulate, the prior's influence naturally dilutes.

**Pre-update pricing:** The Router prices each bet against the curve state *before* that bet shifts it, ensuring traders see fair prices that aren't self-referentially affected by their own trade.

### 1.4 Settlement Against Reality

$\mu$ is the market's *belief*, not the boundary it settles on. A market resolves against an externally-observed final price (set manually via the Router's `set_final_price` for this hackathon PoC — no oracle).

Each position is judged against **its own strike**:
- A YES position at strike $X$ pays $1/token if and only if `final_price >= X`
- A NO position at strike $X$ pays $1/token if and only if `final_price < X`

This means a bet that moves $\mu$ around cannot change who wins — settlement is always against the real-world outcome, not the market's consensus.

### 1.5 AMM Model Comparison

The table below compares OmniCurve with the best binary AMMs currently in production, Polymarket and CPMM markets.

![Amm Market Comparison](./images/AmmComparison.png)

### 1.6 Conclusion

OmniCurve represents a paradigm shift in prediction market design: from discrete binary pools to a continuous, unified liquidity curve. By deriving prices from the Gaussian CDF and making the curve demand-responsive (bettors move it, LPs don't), the protocol achieves unified liquidity, continuous pricing, capital efficiency, and manipulation resistance in a single design. The Gaussian mathematics are computed entirely on-chain using Arbitrum Stylus's Rust-to-WASM compilation, enabling sophisticated financial engineering at layer-2 speed and almost no cost as compared to the L1. 

---

## 2. Architecture

The protocol follows a modular architecture with a clear separation between trade execution (Router), liquidity and collateral management (AMM), LP token accounting (LP Token), and market deployment (Factory). The backend provides real-time indexing and a REST + WebSocket API, while the frontend delivers a quantitative-finance-inspired terminal UI.

### 2.1 High-Level Workflow

![High Level Architecture](./images/HighLevelArch.png)

**User Journey:**

1. **Discover or Create:** Users browse existing markets or create new ones via the Factory
2. **Market Page:** Each market has a dedicated interface with a live Gaussian curve visualization
3. **Trade:** Buy YES or NO positions at any continuous strike price
4. **Provide Liquidity:** Deposit USDC as collateral to underwrite trades and earn fees
5. **Monitor:** Watch the curve shift in real-time as bets move $\mu$ and $\sigma$
6. **Settle:** After resolution, claim winnings or release losing collateral

### 2.2 Contract System: EIP-1167 Proxy Factory

The protocol uses an **EIP-1167 minimal proxy (clone) factory pattern**. Implementation contracts are deployed once; the Factory clones them per-market via CREATE2, giving each market its own trio of proxy contracts with independent storage.

```
OmniCurveFactory.createMarket(usdc, sigma_min)
  ├── deploys AMM Proxy      ──DELEGATECALL──→ AMM Implementation
  ├── deploys Router Proxy   ──DELEGATECALL──→ Router Implementation
  ├── deploys LP Token Proxy ──DELEGATECALL──→ LP Token Implementation
  ├── initializes & wires all three:
  │     AMM ↔ Router (bidirectional)
  │     AMM → LP Token (mint/burn authority)
  │     AMM → USDC token address
  │     AMM → sigma_min floor
  ├── LP Token owner = AMM proxy
  └── transfers AMM + Router ownership to caller (two-step acceptance)
```

**Module Breakdown:**

| Module | Responsibility | Key Functions |
|:-------|:--------------|:-------------|
| `distribution_amm.rs` | Core AMM: liquidity pool, Gaussian params, fee accumulator, collateral custody, curve recomputation | `add_liquidity`, `remove_liquidity`, `underwrite_trade`, `distribute_fee`, `recompute_curve` |
| `binary_router.rs` | Trade execution: CDF pricing, USDC transfers, position bookkeeping, settlement | `buy_yes`, `buy_no`, `set_final_price`, `claim_winnings`, `release_losing_collateral` |
| `factory.rs` | EIP-1167 clone deployer, CREATE2, market registry | `create_market`, `get_market_amm/router/lp_token` |
| `lp_token.rs` | Non-transferable ERC-20 LP receipt token | `mint`, `burn` (AMM-only); `transfer` always reverts |
| `math_core.rs` | On-chain Gaussian math: PDF, CDF, erf, exp, sqrt, WAD arithmetic | `normal_cdf`, `normal_pdf`, `erf_approx`, `exp_wad`, `sqrt_wad` |
| `interfaces.rs` | Cross-contract call interfaces (IERC20, IProxyAmm, etc.) | Solidity-style interface definitions |

### 2.3 Trade Execution Infrastructure

Trading in OmniCurve allows users to express beliefs about continuous outcomes by purchasing YES or NO tokens at any strike price.

**Core Functions:** `buy_yes(target_price, stake_usdc)` and `buy_no(target_price, stake_usdc)` on the Router.

**Execution Flow:**

1. A trader calls `buy_yes` or `buy_no` with their chosen strike price $x$ and USDC stake
2. The Router reads the current $\mu$ and $\sigma$ from the AMM (the *pre-update* curve state)
3. The on-chain Gaussian CDF computes the price:

$$P_{\text{YES}} = 1 - \Phi\left(\frac{x - \mu}{\sigma}\right) \qquad P_{\text{NO}} = \Phi\left(\frac{x - \mu}{\sigma}\right)$$

4. Trade cost is calculated:

$$\text{raw\_cost} = P \times \text{amount} \qquad \text{fee} = \text{raw\_cost} \times 1\% \qquad \text{total} = \text{raw\_cost} + \text{fee}$$

5. USDC is transferred from the trader to the AMM
6. The fee is sent to the AMM's fee accumulator for LP distribution
7. The AMM's `underwrite_trade` locks collateral **and folds the bet into the stake-weighted curve** (weight = premium, x = strike), then recomputes $\mu/\sigma$ and emits `CurveUpdated`
8. Position tokens are minted to the trader (ERC-1155-style, keyed by `keccak256(market_id, target_x, is_yes)`)

**Token IDs:** YES = 1, NO = 2

### 2.4 Liquidity Provision Infrastructure

Liquidity providers in OmniCurve are pure collateral underwriters — they fund the pool that pays out winning bets, and earn trading fees in return.

**Core Functions:** `add_liquidity(amount_wad, target_mu, target_sigma)` and `remove_liquidity(shares_to_remove)` on the AMM.

**Key Design: Curve-Neutral Deposits**

Unlike traditional AMMs where LP deposits affect the trading curve, OmniCurve LP deposits are **strictly curve-neutral**. The `target_mu` and `target_sigma` parameters exist for ABI backward compatibility but are ignored — LPs always provide at the current $\mu/\sigma$ and never shift the curve.

**Add Liquidity Flow:**

1. LP calls `add_liquidity` with a USDC amount
2. USDC is transferred from the LP to the AMM contract
3. LP tokens (non-transferable ERC-20, "OCLP") are minted proportionally
4. The fee accumulator snapshot (`reward_debt`) is set for the LP
5. $\mu$ and $\sigma$ remain unchanged

**Remove Liquidity Flow:**

1. LP calls `remove_liquidity` with the number of LP tokens to burn
2. Solvency is checked: withdrawal cannot exceed available (unlocked) liquidity
3. LP tokens are burned, USDC is returned proportionally
4. Pending fee earnings are settled

### 2.5 Fee Distribution Infrastructure

OmniCurve uses a **MasterChef-style fee accumulator** to distribute trading fees to LPs proportionally without requiring gas-intensive iteration.

**Mechanism:**

- Each trade's 1% fee is sent to the AMM via `distribute_fee`, updating a global accumulator: `acc_fee_per_share`
- Each LP's pending fees = `shares * acc_fee_per_share - reward_debt`
- On deposit, `reward_debt` is set to `shares * acc_fee_per_share` (so new LPs don't claim old fees)
- On withdrawal or `claim_fees`, pending fees are calculated and transferred

This pattern provides O(1) fee distribution regardless of the number of LPs.

### 2.6 Market Resolution Infrastructure

Resolution uses a **two-phase timelock** to provide a dispute window.

**Flow:**

1. **Propose:** Owner calls `propose_resolution(winning_id)` — starts a 24-hour timer
2. **Wait:** Anyone can inspect the proposal during the 24h window; owner can `cancel_resolution`
3. **Execute:** After the timer expires, `execute_resolution()` finalizes the market
4. The market's `is_resolved` flag is set, disabling further trading and liquidity operations

### 2.7 Settlement Infrastructure

After resolution, participants settle positions through a **pull-based claiming** model.

**For Winners:**

- `claim_winnings(target_x, is_yes)` on the Router
- A YES position at strike $X$ wins if `final_price >= X`; a NO position wins if `final_price < X`
- Winning tokens are burned, and USDC is paid out from the AMM's collateral pool

**For Losing Positions:**

- `release_losing_collateral(target_x, is_yes)` — permissionless
- Frees LP collateral that was locked against a position that lost
- Returns the collateral to the available liquidity pool for LP withdrawal

---

## 3. Features

- **Unified Continuous Liquidity:** One pool serves all strike prices — no liquidity fragmentation. Any continuous strike price gets an instant, mathematically derived price from the Gaussian CDF.

- **Demand-Responsive Curve:** $\mu$ and $\sigma$ are stake-weighted aggregates of all bets. The curve tracks collective market belief and requires capital at risk to move — manipulation-resistant by construction.

- **Curve-Neutral LP Deposits:** Liquidity providers are pure collateral underwriters. Their deposits never shift the curve, preventing free manipulation via liquidity.

- **On-Chain Gaussian Mathematics:** Full CDF/PDF computation on-chain using Abramowitz & Stegun erf approximation, 18-term Taylor series exponential, and Newton's method square root — all in 18-decimal fixed-point WAD arithmetic (~11 significant digits).

- **EIP-1167 Proxy Factory:** Deploy unlimited markets from singleton implementations via CREATE2 clones. Each market gets its own isolated storage with shared, gas-efficient implementation code.

- **MasterChef Fee Distribution:** Trading fees (1% per trade) distributed to LPs proportionally via a global accumulator — O(1) gas regardless of LP count.

- **Non-Transferable LP Positions:** LP tokens cannot be traded, simplifying fee accounting and preventing LP position speculation.

- **Two-Phase Resolution with Timelock:** 24-hour dispute window between proposal and execution for market resolution.

- **Real-Time Backend:** Express 5 + Socket.io server watches on-chain events, maintains a PostgreSQL database via Prisma, and broadcasts live curve updates to connected frontends.

- **Quantitative Terminal UI:** React + Vite frontend with d3-powered Gaussian curve visualization, live ETH spot price overlay, and a "signal/noise" design aesthetic inspired by quantitative finance terminals.

---

## 4. Technical Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Rust (`#![no_std]`), Arbitrum Stylus SDK v0.10.7, compiled to `wasm32-unknown-unknown` |
| Monorepo | pnpm workspaces |
| Backend API | Node.js, TypeScript, Express 5, Socket.io |
| Database | Prisma ORM + PostgreSQL |
| Indexer | Goldsky subgraph (from-ABI deployment), GraphQL |
| Frontend | React + TypeScript + Vite + Tailwind + Wagmi/Viem + d3 |
| Shared Types | TypeScript package with ABI exports |
| Deployment | Arbitrum Sepolia testnet |

---

## 5. Getting Started

Follow these instructions to set up the project locally for development and testing.

### 5.1 Prerequisites

- **Rust** (1.88.0+) with `wasm32-unknown-unknown` target
- **Cargo Stylus CLI** for contract deployment
- **Node.js** (v18+) and **pnpm** for the monorepo
- **PostgreSQL** for the backend database
- **Foundry** (optional, for Solidity-based integration tests)

### 5.2 Installation

Clone the repository and install all workspace dependencies:

```bash
git clone <repository_url>
cd OmniCurve
pnpm install
```

### 5.3 Building Contracts

Each contract is compiled separately using Cargo feature flags, producing four WASM binaries from a single crate:

```bash
cd packages/contracts

# Build each contract
cargo build --target wasm32-unknown-unknown --features amm --release
cargo build --target wasm32-unknown-unknown --features router --release
cargo build --target wasm32-unknown-unknown --features lp-token --release
cargo build --target wasm32-unknown-unknown --features factory --release

# Run math unit tests
cargo test
```

### 5.4 Running the Backend

```bash
# Set up environment variables (see .env.example)
# Required: DATABASE_URL, RPC_URL, contract addresses

# Apply database migrations and seed from on-chain state
pnpm --filter @omnicurve/backend db:migrate
pnpm --filter @omnicurve/backend db:seed

# Start the API server (port 3001)
pnpm --filter @omnicurve/backend start:api
```

### 5.5 Running the Frontend

```bash
# Start the Vite dev server
pnpm --filter @omnicurve/frontend dev
```

The frontend connects to the backend API at `localhost:3001` and to Arbitrum Sepolia via Wagmi/Viem.

---

## 6. Deployment

### Contract Deployment

Deploy implementation contracts as singletons, then use the Factory to create markets:

```bash
RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
KEY=<PRIVATE_KEY>

# 1. Deploy each implementation contract
cargo stylus deploy --features amm \
  --private-key $KEY --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm

cargo stylus deploy --features router \
  --private-key $KEY --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm

cargo stylus deploy --features lp-token \
  --private-key $KEY --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm

cargo stylus deploy --features factory \
  --private-key $KEY --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm

# 2. Initialize the Factory with implementation addresses
cast send <FACTORY> \
  "initialize(address,address,address,address)" \
  <OWNER> <AMM_IMPL> <ROUTER_IMPL> <LP_TOKEN_IMPL> \
  --private-key $KEY --rpc-url $RPC_URL

# 3. Create a market
cast send <FACTORY> \
  "createMarket(address,int256)" \
  <USDC_ADDRESS> <SIGMA_MIN_WAD> \
  --private-key $KEY --rpc-url $RPC_URL

# 4. Accept ownership on AMM and Router proxies
cast send <AMM_PROXY> "acceptOwnership()" --private-key $KEY --rpc-url $RPC_URL
cast send <ROUTER_PROXY> "acceptOwnership()" --private-key $KEY --rpc-url $RPC_URL

# 5. Seed the initial distribution
cast send <AMM_PROXY> "setDistribution(int256,int256)" <MU_WAD> <SIGMA_WAD> \
  --private-key $KEY --rpc-url $RPC_URL
```

### Deployed Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| AMM Implementation | `0x0d08e6c457bfe0794b258e66c20a788cc8a8fa32` |
| Router Implementation | `0x98846991e02802b20bf947cfe11b4ac6ff463d9f` |
| LP Token Implementation | `0xce5ce25964af3c917ebca5c972abec94022b868a` |
| Factory | `0xf6bfadc33c3c42755d9634defbfcc52b8b2d5e24` |
| Market #0 AMM Proxy | `0x9736E98CA898Bf69daA126e715Eb639D2DaBFb46` |
| Market #0 Router Proxy | `0xA65b5453a177d3C34654Ec4Be60754d0aD7ec6A5` |
| Market #0 LP Token Proxy | `0x731489Ab2A0029a22a95b5Ea3f72335b18D40CCf` |
| USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

---

## 7. Project Status

- **Current Stage:** The protocol is a **hackathon proof-of-concept** deployed on Arbitrum Sepolia with a live market ("What will ETH price be by the end of 2026?").
- **Audits:** The smart contracts have **not undergone a formal security audit**. Use at your own risk.
- **Testing:** Rust unit tests cover the mathematical core (`math_core.rs`). Foundry integration tests exist for cross-contract interactions. The mathematical implementation provides ~11 significant digits of precision against reference values.
- **Known Limitations:**
    - `claim_fees` has a WAD-to-USDC conversion bug (missing `/1e12` — fees are locked)
    - No slippage protection on trades
    - Resolution is fully manual (no oracle integration)
    - Positions are non-transferable

---

## 8. Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/NewFeature`)
3. Make your changes and commit them (`git commit -m 'Add NewFeature'`)
4. Ensure changes include corresponding tests
5. Push to your branch (`git push origin feature/NewFeature`)
6. Open a Pull Request for review

---

## 9. Project License

This project is licensed under the **MIT License**.

---

## 10. References

- **Gaussian Distribution (Normal Distribution):** [Wikipedia — Normal Distribution](https://en.wikipedia.org/wiki/Normal_distribution)
- **Abramowitz & Stegun Error Function Approximation:** Handbook of Mathematical Functions, Formula 7.1.26
- **EIP-1167 Minimal Proxy Standard:** [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167)
- **Arbitrum Stylus Documentation:** [Arbitrum Stylus](https://docs.arbitrum.io/stylus/gentle-introduction)
- **MasterChef Fee Distribution Pattern:** [SushiSwap MasterChef](https://docs.sushi.com/)
- **Prediction Market Design:** [Paradigm PM-AMM Research](https://www.paradigm.xyz/2024/11/pm-amm)

