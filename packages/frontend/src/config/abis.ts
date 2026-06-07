export const BINARY_ROUTER_ABI = [{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"target_price","type":"int256"},{"internalType":"uint256","name":"amount_wad","type":"uint256"}],"name":"buyNo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"target_price","type":"int256"},{"internalType":"uint256","name":"amount_wad","type":"uint256"}],"name":"buyYes","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"is_yes","type":"bool"},{"internalType":"uint256","name":"amount_wad","type":"uint256"}],"name":"claimWinnings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"token_id","type":"uint256"}],"name":"getBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"setAmmAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"setUsdcToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"final_price","type":"int256"}],"name":"settleByPrice","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"new_owner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;

export const ERC20_ABI = [
  {
    "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const DISTRIBUTION_AMM_ABI = [{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount_wad","type":"uint256"},{"internalType":"int256","name":"target_mu","type":"int256"},{"internalType":"int256","name":"target_sigma","type":"int256"}],"name":"addLiquidity","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"cancelResolution","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"claimFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"fee_amount","type":"uint256"}],"name":"distributeFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"executeResolution","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"x","type":"int256"},{"internalType":"bool","name":"is_yes","type":"bool"}],"name":"getPriceForX","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"globalMu","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"globalSigma","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"token_id","type":"uint256"},{"internalType":"uint256","name":"amount_wad","type":"uint256"}],"name":"payoutWinnings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"winning_id","type":"uint256"}],"name":"proposeResolution","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"shares_to_remove","type":"uint256"}],"name":"removeLiquidity","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"mu","type":"int256"},{"internalType":"int256","name":"sigma","type":"int256"}],"name":"setDistribution","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"setRouterAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"min","type":"int256"}],"name":"setSigmaMin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"setUsdcToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"sweepDust","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"new_owner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"token_id","type":"uint256"},{"internalType":"uint256","name":"premium_wad","type":"uint256"},{"internalType":"uint256","name":"max_liability_wad","type":"uint256"}],"name":"underwriteTrade","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;

// Addresses from backend .env or hardcoded for testnet
export const CONTRACTS = {
  BINARY_ROUTER: '0x1d3d7c750453AF93eD496dF90DcA4A540A5E36D7' as `0x${string}`,
  DISTRIBUTION_AMM: '0xB80051AD3F5C1678424D2C7B8Fb9f9776a701942' as `0x${string}`,
  FACTORY: '0x872f2aac62bd05fa33de5ba5260482e3ca59bd05' as `0x${string}`,
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as `0x${string}`,
} as const;
