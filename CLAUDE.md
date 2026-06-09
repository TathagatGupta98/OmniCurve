# OmniCurve — Full Project Context

## What is OmniCurve?

OmniCurve is a **unified continuous distribution prediction market protocol** built on **Arbitrum Stylus** (Rust compiled to WASM). The name comes from its core innovation: instead of creating many separate binary "yes/no" prediction pools (like Polymarket), OmniCurve collapses all possible outcomes into a **single continuous liquidity curve** — an "omni-curve" — governed by a Gaussian (normal) probability density function.

### The Core Idea

Traditional prediction markets create discrete binary pools: "Will BTC hit $100k? Yes/No." Each price point needs its own pool, fragmenting liquidity. OmniCurve replaces this with a single pool where the **probability of any outcome is derived from the cumulative distribution function (CDF) of a Gaussian distribution**:

- **P_YES(x)** = 1 − CDF(x, μ, σ) — probability that the outcome exceeds strike price x
- **P_NO(x)** = CDF(x, μ, σ) — probability that the outcome is at or below strike price x

Where μ (mu) is the market's expected value (mean) and σ (sigma) is the market's uncertainty (standard deviation). These parameters are set by liquidity providers and frozen once trading begins.

### Why it matters

1. **Unified liquidity**: One pool serves all strike prices, not N separate pools
2. **Continuous pricing**: Any strike price gets an instant, mathematically derived price
3. **Capital efficiency**: LPs provide liquidity once; it covers the full outcome space
4. **On-chain math**: The Gaussian CDF is computed entirely on-chain using fixed-point WAD arithmetic and an Abramowitz & Stegun error function approximation

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Rust (`#![no_std]`), Arbitrum Stylus SDK v0.10.7, compiled to `wasm32-unknown-unknown` |
| Monorepo | pnpm workspaces |
| Backend API | Node.js, TypeScript, Express 5, Socket.io |
| Database | Prisma ORM + PostgreSQL, migrations in `prisma/migrations/` |
| Indexer | Goldsky subgraph (from-ABI deployment), GraphQL |
| Frontend | React + TypeScript + Tailwind + Wagmi/Viem (placeholder, not yet built) |
| Shared Types | TypeScript package with ABI exports |
| Deployment | Arbitrum Sepolia testnet |

---

## Monorepo Structure

```
OmniCurve/
├── packages/
│   ├── contracts/          # Arbitrum Stylus Rust smart contracts
│   │   ├── src/
│   │   │   ├── main.rs             # Feature-gated entrypoint (amm/router/factory/lp-token)
│   │   │   ├── lib.rs              # Module declarations with feature gates
│   │   │   ├── distribution_amm.rs # Core AMM: liquidity, fees, resolution, USDC custody
│   │   │   ├── binary_router.rs    # Trade execution: buyYes/buyNo, CDF pricing, positions
│   │   │   ├── factory.rs          # EIP-1167 minimal proxy factory, CREATE2 deployment
│   │   │   ├── lp_token.rs         # Non-transferable ERC-20 LP receipt token
│   │   │   ├── math_core.rs        # Gaussian PDF/CDF, erf approximation, WAD arithmetic
│   │   │   └── interfaces.rs       # Cross-contract interfaces (IERC20, IProxyAmm, etc.)
│   │   ├── test/
│   │   │   └── OmniCurve.t.sol     # Foundry tests with mock contracts
│   │   ├── Cargo.toml              # Rust dependencies and feature flags
│   │   ├── Stylus.toml             # Stylus network endpoints
│   │   ├── rust-toolchain.toml     # Rust 1.88.0 with wasm32 target
│   │   └── README.md               # Deployment guide and deployed addresses
│   │
│   ├── backend/            # Node.js API & real-time server
│   │   ├── src/
│   │   │   ├── server.ts           # Express 5 entry point (port 3001)
│   │   │   ├── config.ts           # Zod-validated environment config
│   │   │   ├── controllers/
│   │   │   │   └── marketController.ts  # Market REST handlers
│   │   │   ├── services/
│   │   │   │   ├── marketService.ts     # Prisma queries for markets
│   │   │   │   ├── indexerService.ts    # Goldsky event ingestion (idempotent)
│   │   │   │   ├── mathService.ts       # Gaussian CDF via jStat, price preview
│   │   │   │   └── chainService.ts      # viem on-chain reads + startChainWatcher()
│   │   │   ├── sockets/
│   │   │   │   └── socketManager.ts     # Socket.io rooms, requestPrice, broadcasts
│   │   │   ├── webhooks/
│   │   │   │   └── goldskyHandler.ts    # POST /webhooks/goldsky (HMAC verified)
│   │   │   ├── middlewares/
│   │   │   │   ├── errorHandler.ts      # Global error handler
│   │   │   │   ├── goldskyAuth.ts       # HMAC-SHA256 webhook signature verification
│   │   │   │   └── rateLimiter.ts       # 100 req/min per IP
│   │   │   ├── models/
│   │   │   │   └── db.ts               # Prisma client singleton
│   │   │   ├── routes/
│   │   │   │   ├── health.ts           # GET /api/health
│   │   │   │   ├── marketRoutes.ts     # Market + price + lp-stats + settle routes
│   │   │   │   ├── userRoutes.ts       # GET /api/users/:address/portfolio
│   │   │   │   └── apiDocs.ts          # GET /api/docs (OpenAPI-style JSON schema)
│   │   │   ├── db/
│   │   │   │   ├── seed.ts             # Seed DB from Factory on-chain state
│   │   │   │   └── abis.ts             # Minimal ABI fragments for viem
│   │   │   └── types/
│   │   │       └── jstat.d.ts          # Type declaration for jstat library
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # User / Market / Position models
│   │   │   └── migrations/
│   │   │       ├── migration_lock.toml
│   │   │       └── 20260609000000_init/
│   │   │           └── migration.sql   # Initial schema migration
│   │   ├── SOCKET_EVENTS.md           # Socket.io event reference for frontend
│   │   ├── goldsky-amm.json           # Goldsky from-ABI subgraph config
│   │   ├── prisma.config.ts           # Prisma config
│   │   └── package.json
│   │
│   ├── frontend/           # Placeholder — not yet built
│   │   └── package.json
│   │
│   └── types/              # Shared TypeScript types & ABIs
│       ├── src/
│       │   └── index.ts             # Re-exports ABI JSON files
│       ├── abis/
│       │   ├── distribution_amm.json  # AMM ABI (snake_case, current)
│       │   ├── binary_router.json     # Router ABI (snake_case, current)
│       │   └── factory.json           # Factory ABI (snake_case, current)
│       └── package.json
│
├── types/abis/                        # Root-level ABIs (PascalCase, potentially stale)
│   ├── DistributionAmm.json
│   ├── BinaryRouter.json
│   └── OmniCurveFactory.json
│
├── .env                    # Root env (deployed addresses, Goldsky endpoint)
├── package.json            # Root workspace config
├── pnpm-workspace.yaml     # Workspace package declarations
├── tsconfig.json           # Root TypeScript config with path aliases
└── DEVELOPER_CONTEXT.md    # Architecture guardrails
```

---

## Smart Contract Architecture

### Contract System

The protocol uses an **EIP-1167 minimal proxy (clone) factory pattern**:

1. **Implementation contracts** are deployed once (AMM, Router, LP Token)
2. **OmniCurveFactory** clones them per-market via CREATE2
3. Each market gets its own trio of proxy contracts
4. Proxies use DELEGATECALL to share implementation code but have independent storage

```
OmniCurveFactory
├── AMM Implementation (singleton)
├── Router Implementation (singleton)
├── LP Token Implementation (singleton)
│
├── Market #0
│   ├── AMM Proxy ──DELEGATECALL──→ AMM Implementation
│   ├── Router Proxy ──DELEGATECALL──→ Router Implementation
│   └── LP Token Proxy ──DELEGATECALL──→ LP Token Implementation
│
├── Market #1 (when created)
│   ├── AMM Proxy ──DELEGATECALL──→ AMM Implementation
│   └── ...
```

### Build System

Each contract is compiled separately using Cargo feature flags:

```bash
cargo build --target wasm32-unknown-unknown --features amm --release
cargo build --target wasm32-unknown-unknown --features router --release
cargo build --target wasm32-unknown-unknown --features lp-token --release
cargo build --target wasm32-unknown-unknown --features factory --release
```

The `main.rs` and `lib.rs` files use `#[cfg(feature = "...")]` to conditionally compile only the relevant contract module. This produces four separate WASM binaries from a single crate.

### Feature Flags

| Flag | Compiles | Entrypoint |
|------|----------|------------|
| `amm` | `distribution_amm` + `math_core` + `interfaces` | `DistributionAmm` |
| `router` | `binary_router` + `math_core` + `interfaces` | `BinaryRouter` |
| `factory` | `factory` + `interfaces` | `OmniCurveFactory` |
| `lp-token` | `lp_token` | `LpToken` |

---

## Contract Details

### DistributionAmm (distribution_amm.rs)

The core AMM contract. Manages:

- **Gaussian distribution parameters**: `global_mu` (mean) and `global_sigma` (std dev), set by owner pre-trading or shifted by LP deposits
- **Liquidity pool**: `available_liquidity` (WAD) tracks free collateral; `locked_collateral` (WAD) tracks encumbered funds
- **LP tokens**: Mints/burns via the paired LpToken proxy
- **Fee distribution**: MasterChef-style accumulator (`acc_fee_per_share`, `reward_debt` per user) — fees from trades distributed pro-rata to LPs
- **Market resolution**: Two-phase with 24h timelock — `proposeResolution(winning_id)` → wait 24h → `executeResolution()`
- **Payout**: After resolution, winning token holders claim via `payoutWinnings`
- **USDC custody**: All USDC is held by the AMM proxy

**Key storage (WAD = 1e18 fixed-point):**
```rust
sol_storage! {
    pub struct DistributionAmm {
        address owner;
        address pending_owner;
        int256 global_mu;            // Gaussian mean (WAD)
        int256 global_sigma;         // Gaussian std dev (WAD)
        int256 sigma_min;            // Minimum allowed sigma (WAD)
        int256 available_liquidity;  // Free collateral (WAD)
        int256 locked_collateral;    // Encumbered by trades (WAD)
        address usdc_token;
        address router_address;
        address lp_token_address;
        int256 acc_fee_per_share;    // MasterChef accumulator (WAD)
        mapping(address => int256) reward_debt;
        bool is_resolved;
        uint256 winning_token_id;    // 1 = YES, 2 = NO
        bool trades_started;         // Freezes curve after first trade
        uint256 resolution_time;     // Timelock expiry (unix timestamp)
        uint256 proposed_winning_id;
        mapping(uint256 => int256) token_liabilities; // Per-token liability tracking
    }
}
```

**Key functions:**
- `initialize(owner)` — One-time setup
- `set_distribution(mu, sigma)` — Set curve params (owner only, pre-trading only)
- `add_liquidity(amount_wad, target_mu, target_sigma)` — Deposit USDC, receive LP tokens; shifts curve (pre-trading only)
- `remove_liquidity(shares_to_remove)` — Burn LP tokens, withdraw USDC (solvency checked)
- `get_price_for_x(x, is_yes)` — Read-only: returns CDF-derived price for a strike
- `distribute_fee(fee_amount)` — Called by Router: updates fee accumulator
- `underwrite_trade(token_id, premium_wad, max_liability_wad)` — Called by Router: locks collateral
- `propose_resolution(winning_id)` → `execute_resolution()` — Two-phase market settlement
- `payout_winnings(user, token_id, amount_wad)` — Called by Router: pays USDC to winners
- `claim_fees()` — LPs claim accumulated trading fees
- `sweep_dust()` — Owner recovers USDC rounding remainders

### BinaryRouter (binary_router.rs)

The user-facing trade execution contract:

- **Reads** μ and σ from the AMM
- **Computes** CDF-derived prices on-chain using `math_core::gaussian_cdf`
- **Executes** USDC transfers (user → AMM) and position bookkeeping
- **Manages** YES/NO position balances (non-transferable)
- **1% fee** deducted from each trade, sent to AMM for LP distribution
- **Reentrancy guard** via `bool locked` storage variable

**Token IDs:** YES = 1, NO = 2

**Key functions:**
- `buy_yes(target_price, amount_wad)` / `buy_no(target_price, amount_wad)` — Execute trades
- `claim_winnings(is_yes, amount_wad)` — Post-resolution: redeem winning positions for USDC
- `settle_by_price(final_price)` — Owner settles: if `final_price >= mu`, YES wins
- `get_balance(user, token_id)` — Read position balance

**Trade cost calculation:**
```
p_yes = 1 - CDF(target_price, μ, σ)
p_no = CDF(target_price, μ, σ)
raw_cost_wad = price × amount_wad / 1e18
fee_wad = raw_cost_wad / 100           (1%)
total_cost_wad = raw_cost_wad + fee_wad
cost_usdc = ceil(total_cost_wad / 1e12) (WAD → USDC 6 decimals)
```

### LpToken (lp_token.rs)

Non-transferable ERC-20:
- `transfer()` and `transferFrom()` always revert — LP positions cannot be traded
- Only the AMM proxy (owner) can `mint()` and `burn()`
- 18 decimals, named "OmniCurve LP" / "OCLP"
- `approve()` is technically functional but useless since transfers are disabled

### OmniCurveFactory (factory.rs)

Market deployer:
- Stores implementation addresses for AMM, Router, LP Token
- `create_market(usdc, sigma_min)` — Deploys 3 EIP-1167 clones via CREATE2, initializes and wires them
- Two-step ownership: Factory transfers AMM + Router ownership to caller; caller must `acceptOwnership()`
- LP Token owner is always the AMM proxy (set during factory `initialize`)
- Currently owner-only for market creation

### math_core.rs

On-chain Gaussian math library (compiled into both AMM and Router):

- **WAD arithmetic**: `wad_mul(a, b) = a × b / 1e18`, `wad_div(a, b) = a × 1e18 / b`
- **Gaussian PDF**: `gaussian_pdf(x, mu, sigma)` — normalized probability density
- **Gaussian CDF**: `gaussian_cdf(x, mu, sigma)` — cumulative distribution (0 to 1 WAD)
- **Error function**: `erf_approx(x)` — Abramowitz & Stegun 5-coefficient polynomial approximation (max error ~1.5×10⁻⁷)
- **Exponential**: `exp_wad(x)` — 18-term Taylor series expansion, clamped to [-20, +20] WAD

All functions use I256 (signed 256-bit integer) with 18-decimal fixed-point (WAD) representation.

---

## Deployed Addresses (Arbitrum Sepolia)

### Implementation Contracts (singletons)
| Contract | Address |
|----------|---------|
| AMM Implementation | `0xdcdd8e30284d50a7df5d0f5d110bd57118c299aa` |
| Router Implementation | `0x53ad98ecf5e8f9d80a2ec037297679bb3abf802e` |
| LP Token Implementation | `0xcf8f9aef697550f67aa64369ed23dd1a8160baf2` |
| Factory | `0x1bbdb700863309ab2588c9d64786bd0ac376d150` |

### Market #0 Proxies
| Contract | Address |
|----------|---------|
| AMM Proxy | `0x7cd2d6c56fbC52552C5014b00FC30176E388fB0f` |
| Router Proxy | `0xF1FB7FA83E5Cdfbe975ad139dbD35b223E554CdB` |
| LP Token Proxy | `0x2Cd7b0016134D5dcf92da81A981e0dFcaC3e6250` |

**Owner:** `0xE958DaE545e5dAd0b4bE2E58432298dfd5178342`

### Legacy Addresses (pre-factory, in .env files)
| Contract | Address | Notes |
|----------|---------|-------|
| Old AMM | `0xb4f1cf16d4da2c35956706c25fc194c0df14260e` | In root .env and backend .env |
| Old Router | `0x334cec716c70f2aaace00e321ecc67bbe4a01c14` | In root .env and backend .env |
| USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Arbitrum Sepolia USDC |

### Goldsky Subgraph
- Endpoint: `https://api.goldsky.com/api/public/project_cmq17mffxi3ym01zj0wsd8eib/subgraphs/omnicurve-amm-arbitrum-sepolia/1.0.2/gn`
- Indexes: CurveUpdated events from AMM, TradeExecuted events from Router
- Note: Currently points to the old pre-factory addresses

---

## Backend Architecture

Single TypeScript stack — Express 5 + Socket.io + Prisma + viem.

### Entry & Config
- **`src/server.ts`** — Express 5 + Socket.io + Helmet + CORS + rate limiter; calls `startChainWatcher()` after `httpServer.listen()`
- **`src/config.ts`** — Zod-validated env; crashes at startup if any required var is missing

### REST API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server liveness check |
| GET | `/api/markets` | List all markets (`?category=&active=`) |
| GET | `/api/markets/:id` | Market detail + positions |
| GET | `/api/markets/:id/price?x=&direction=` | Price preview: `{pYes, pNo, grossCostWad, feeCostWad}` |
| GET | `/api/markets/:id/lp-stats?address=` | LP balance, accFeePerShare, pending rewards |
| POST | `/api/markets/:id/settle` | Owner-only: returns `winning_token_id` (no chain tx) |
| GET | `/api/users/:address/portfolio` | All positions + current value for a wallet |
| POST | `/api/webhooks/goldsky` | Goldsky event receiver (HMAC-SHA256 verified) |
| GET | `/api/docs` | OpenAPI-style JSON schema |

### Socket.io Events
See `SOCKET_EVENTS.md` for the full reference. Key events:
- Client emits `joinMarket(marketId)` → server immediately emits current state from Prisma
- Client emits `requestPrice({marketId, x, direction})` → server emits `priceUpdate` back to that socket only
- Server broadcasts `marketStateUpdated` and `marketResolved` to the market room on every chain event

### Services
- **`chainService.ts`** — viem `createPublicClient` on arbitrum-sepolia; `getMarketState()`, `getLpTokenBalance()`, `computePendingRewards()`; `startChainWatcher()` watches `CurveUpdated`, `LiquidityAdded/Removed`, `TradeExecuted`, `MarketResolved` — updates Prisma and broadcasts Socket.io on each event
- **`indexerService.ts`** — Goldsky webhook event handlers; idempotency guard prevents double-counting on retries
- **`mathService.ts`** — `calculatePricePreview(x, direction, mu, sigma, stakeAmount?)` via jStat; includes 1% fee breakdown

### Database
Prisma ORM with PostgreSQL. Migration applied via `prisma migrate deploy`.

**Models:**
```
User:     walletAddress (PK), rolePreference, globalAccumulatorSnapshot, totalLiquidityProvided
Market:   marketId (PK), title, category, currentMu, currentSigma, totalLiquidity,
          globalAccumulator, minVarianceBound, ammAddress, routerAddress, lpTokenAddress,
          isResolved, winningTokenId
Position: positionId (PK), userAddress (FK), marketId (FK), targetValueX,
          direction (ABOVE|BELOW), tokensMinted, stakeAmount
```

---

## Known Issues & Gaps

### Critical/High Priority
1. **`claim_fees` bug**: Sends WAD amount as USDC (missing `/1e12` conversion) — fees are permanently locked
2. **`I256::into_raw()` on negative values**: Produces garbage U256 — affects event emissions and sweep_dust edge case
3. **No slippage protection**: Trades have no max cost parameter

### Medium Priority
4. **ABI drift**: Two ABI directories (`types/abis/` root vs `packages/types/abis/`) with different naming and potentially different contents
5. **Backend .env points to old contract addresses**: Needs updating to factory-deployed proxies
6. **1% fee hardcoded**: No governance or per-market configuration
7. **`execute_settlement` is dead code**: Does nothing, misleading for integrators
8. **`create_market` is owner-only**: Prevents permissionless market creation

### Not Yet Built
- **Frontend**: Only a placeholder `package.json` exists
- **docker-compose.yml**: Mentioned in DEVELOPER_CONTEXT.md but not created
- **Integration tests**: No end-to-end tests across contract interactions
- **Oracle integration**: Resolution is fully manual (owner calls `settleByPrice`)
- **Position transfers**: Positions are non-transferable

---

## Development Commands

```bash
# Workspace
pnpm install                          # Install all dependencies

# Contracts — Build
cargo build --target wasm32-unknown-unknown --features amm --release
cargo build --target wasm32-unknown-unknown --features router --release
cargo build --target wasm32-unknown-unknown --features lp-token --release
cargo build --target wasm32-unknown-unknown --features factory --release

# Contracts — Deploy (Stylus)
cargo stylus deploy --features amm --private-key $KEY --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm

# Contracts — Tests
cargo test                            # Rust unit tests (math_core)
forge test                            # Foundry tests (mock contracts)

# Backend
pnpm --filter @omnicurve/backend start            # migrate + seed + start:api (production)
pnpm --filter @omnicurve/backend start:api        # Express server only (port 3001)
pnpm --filter @omnicurve/backend db:migrate       # Apply prisma/migrations via migrate deploy
pnpm --filter @omnicurve/backend db:push          # Push schema without migrations (dev only)
pnpm --filter @omnicurve/backend db:seed          # Seed DB from Factory on-chain state

# Goldsky subgraph
pnpm --filter @omnicurve/backend deploy:subgraph:amm
```

---

## Key Design Decisions

1. **Gaussian CDF for pricing**: Probability = area under Gaussian curve, computed on-chain via Abramowitz & Stegun erf approximation with 18-term Taylor series exponential. Provides ~11 significant digits of precision.

2. **Curve freezes on first trade**: `trades_started` flag becomes true when `underwrite_trade` is first called. After this, LP deposits still accept USDC and mint LP tokens, but the `target_mu`/`target_sigma` parameters are silently ignored. This prevents curve manipulation post-trading.

3. **MasterChef-style fee distribution**: Trading fees are distributed to LPs proportionally via a global accumulator pattern. Each LP's pending fees = `shares × acc_fee_per_share - reward_debt`.

4. **Non-transferable LP tokens**: LP positions cannot be transferred or traded. This simplifies the fee accounting (no need to update reward_debt on transfer) but limits composability.

5. **Two-phase resolution with timelock**: Resolution requires `proposeResolution` (starts 24h timer) → `executeResolution` (after timer). Owner can `cancelResolution` during the window. This provides a dispute period but is currently hardcoded to 24h.

6. **WIN/LOSE determined by μ**: In `settle_by_price(final_price)`, YES wins if `final_price >= global_mu`. The mean is both the expected value and the settlement boundary.

7. **USDC (6 decimals) vs WAD (18 decimals)**: All internal accounting uses WAD (1e18). USDC transfers convert via `/1e12`. The `sweep_dust` function recovers rounding remainders.

8. **EIP-1167 proxies are immutable**: Once deployed, a proxy's implementation cannot be changed. To upgrade a market's logic, a new market must be created with the updated implementation, and liquidity must be migrated manually.
