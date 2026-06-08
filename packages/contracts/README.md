# OmniCurve Contracts — Deployment

## Deployed Addresses (Arbitrum Sepolia)

### Implementation Contracts (deployed once)

| Contract | Address | Tx Hash |
|----------|---------|---------|
| AMM Implementation | `0x71404fb3ce6e3fcaae68de306c5e17cf2f0f0607` | `0x16b6e6a2ce89ef45d2b7139a1cf7b1c1515d4ce847bbe9a79a2045d1310acb41` |
| Router Implementation | `0x5d4a4994810a3b4461922817897246f42536a79c` | `0x8451d9e8d8b90000f21287e661985874bfdf14fa7496b9d47446383fddfa3c98` |
| Factory | `0x27425a4f1f890a24c724fcf147889bbb8707414d` | `0x9ef52a38e95734a9536dca0792a3b5c49f4ce594eacc3e90e08c522c93736029` |

### Market 0 Proxy Contracts (deployed by factory)

| Contract | Address |
|----------|---------|
| AMM Proxy | `0x68990a146f88f501629128e520f36455d019dd93` |
| Router Proxy | `0xeb3ae813d8bab38cd0edf07bf739da1a0f773613` |

**Owner:** `0xE958DaE545e5dAd0b4bE2E58432298dfd5178342`

## Architecture

The **Factory** contract deploys EIP-1167 minimal proxy clones of the AMM and Router implementations for each new market via `CREATE2`. This means you only deploy three contracts once, then create unlimited markets through the factory.

```
Factory.createMarket(usdc, sigma_min)
  ├── deploys AMM proxy clone    (DELEGATECALL → AMM Implementation)
  ├── deploys Router proxy clone (DELEGATECALL → Router Implementation)
  ├── initializes & wires both
  └── transfers ownership to caller
```

## Build Commands

```bash
cargo build --target wasm32-unknown-unknown --features amm --release
cargo build --target wasm32-unknown-unknown --features router --release
cargo build --target wasm32-unknown-unknown --features factory --release
```

## Deployment Commands

```bash
# 1. AMM Implementation ✅
cargo stylus deploy --features amm \
  --private-key <KEY> --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm \
  --max-fee-per-gas-gwei 0.1

# 2. Router Implementation ✅
cargo stylus deploy --features router \
  --private-key <KEY> --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm \
  --max-fee-per-gas-gwei 0.1

# 3. Factory ✅
cargo stylus deploy --features factory \
  --private-key <KEY> --endpoint $RPC_URL --no-verify \
  --wasm-file target/wasm32-unknown-unknown/release/omnicurve_contracts.wasm \
  --max-fee-per-gas-gwei 0.1
```

## Post-Deployment Setup

```bash
# 4. Initialize factory ✅
cast send 0x27425a4f1f890a24c724fcf147889bbb8707414d \
  "initialize(address,address,address)" \
  0xE958DaE545e5dAd0b4bE2E58432298dfd5178342 \
  0x71404fb3ce6e3fcaae68de306c5e17cf2f0f0607 \
  0x5d4a4994810a3b4461922817897246f42536a79c \
  --private-key <KEY> --rpc-url $RPC_URL

# 5. Create a market ✅
cast send 0x27425a4f1f890a24c724fcf147889bbb8707414d \
  "createMarket(address,int256)" \
  <USDC_ADDRESS> 100000000000000000 \
  --private-key <KEY> --rpc-url $RPC_URL

# 6. Get deployed proxy addresses ✅
cast call 0x27425a4f1f890a24c724fcf147889bbb8707414d "getMarketAmm(uint256)" 0 --rpc-url $RPC_URL
# → 0x68990a146f88f501629128e520f36455d019dd93
cast call 0x27425a4f1f890a24c724fcf147889bbb8707414d "getMarketRouter(uint256)" 0 --rpc-url $RPC_URL
# → 0xeb3ae813d8bab38cd0edf07bf739da1a0f773613

# 7. Accept ownership on both proxies ✅
cast send 0x68990a146f88f501629128e520f36455d019dd93 "acceptOwnership()" --private-key <KEY> --rpc-url $RPC_URL
cast send 0xeb3ae813d8bab38cd0edf07bf739da1a0f773613 "acceptOwnership()" --private-key <KEY> --rpc-url $RPC_URL
```

## Creating Additional Markets

No new contract deployments needed. Each `createMarket` call deploys a fresh AMM+Router proxy pair automatically.

### Step 1: Check current market count

```bash
cast call 0x27425a4f1f890a24c724fcf147889bbb8707414d "getMarketCount()" --rpc-url $RPC_URL
```

The returned value is the next `market_id` that will be assigned.

### Step 2: Create the market

```bash
cast send 0x27425a4f1f890a24c724fcf147889bbb8707414d \
  "createMarket(address,int256)" \
  <USDC_ADDRESS> <SIGMA_MIN_WAD> \
  --private-key <KEY> --rpc-url $RPC_URL
```

`SIGMA_MIN_WAD` is in 18-decimal WAD format. Common values:
- `100000000000000000` = 0.1 (reasonable default)
- `10000000000000000` = 0.01 (tight curve)
- `1000000000000000000` = 1.0 (wide curve)

### Step 3: Query the new proxy addresses

Replace `<MARKET_ID>` with the value from Step 1 (0, 1, 2, ...):

```bash
cast call 0x27425a4f1f890a24c724fcf147889bbb8707414d "getMarketAmm(uint256)" <MARKET_ID> --rpc-url $RPC_URL
cast call 0x27425a4f1f890a24c724fcf147889bbb8707414d "getMarketRouter(uint256)" <MARKET_ID> --rpc-url $RPC_URL
```

### Step 4: Accept ownership on both proxies

The factory initiated a two-step ownership transfer. Finalize it:

```bash
cast send <AMM_PROXY> "acceptOwnership()" --private-key <KEY> --rpc-url $RPC_URL
cast send <ROUTER_PROXY> "acceptOwnership()" --private-key <KEY> --rpc-url $RPC_URL
```

### Step 5: Configure the market

Once you own the proxies, set the initial distribution before trading begins:

```bash
# Set the price distribution (mu = center price in WAD, sigma = std dev in WAD)
cast send <AMM_PROXY> "setDistribution(int256,int256)" <MU_WAD> <SIGMA_WAD> \
  --private-key <KEY> --rpc-url $RPC_URL
```

After this, LPs can `addLiquidity` and traders can `buyYes`/`buyNo` through the Router proxy.
