extern crate alloc;

use alloy_primitives::{I256, U256, Address, FixedBytes};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;
use alloc::vec;
use alloc::vec::Vec;

use crate::interfaces::IERC20;
use crate::math_core::{normal_cdf, safe_to_u256};

#[inline(always)] fn wad() -> I256 { I256::try_from(1_000_000_000_000_000_000i128).unwrap() }

sol_interface! {
    interface IDistributionAmm {
        function globalMu() external view returns (int256);
        function globalSigma() external view returns (int256);
        function distributeFee(uint256 fee_amount) external;
        function payoutWinnings(address user, uint256 token_id, uint256 amount_wad) external;
        function underwriteTrade(uint256 token_id, int256 target_x, uint256 premium_wad, uint256 max_liability_wad) external;
        function releaseCollateral(uint256 token_id) external;
    }
}

sol! {
    event TradeExecuted(address indexed user, uint256 token_id, int256 target_price, bool is_yes, uint256 tokens_minted);
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event MarketResolved(int256 final_price);
    event WinningsClaimed(address indexed user, uint256 token_id, uint256 amount);
    event URI(string value, uint256 indexed id);
}

sol_storage! {
    #[entrypoint]
    pub struct BinaryRouter {
        address owner;
        address pending_owner;
        address amm_address;
        address usdc_token;
        bool locked;

        // H4+M1: Per-threshold token accounting
        // token_id = keccak256(market_id, target_x, is_yes)
        mapping(address => mapping(uint256 => uint256)) staker_balances;

        // Market identity — set by factory at initialization
        uint256 market_id;

        // H6: Market resolution — pull-based claiming
        int256 final_price;
        bool market_resolved;

        // M1: ERC-1155 operator approvals
        mapping(address => mapping(address => bool)) operator_approvals;

        // Track total supply per token_id for ERC-1155
        mapping(uint256 => uint256) token_supplies;
    }
}

pub enum Error {
    AmmCallFailed,
    UsdcTransferFailed,
    Unauthorized,
    Reentrancy,
    NotResolved,
    NotWinner,
    NoTokens,
    InsufficientBalance,
    ZeroAmount,
    TransferToZero,
}

impl From<Error> for Vec<u8> {
    fn from(e: Error) -> Self {
        match e {
            Error::AmmCallFailed => b"AmmCallFailed".to_vec(),
            Error::UsdcTransferFailed => b"UsdcTransferFailed".to_vec(),
            Error::Unauthorized => b"Unauthorized".to_vec(),
            Error::Reentrancy => b"Reentrancy".to_vec(),
            Error::NotResolved => b"MarketNotResolved".to_vec(),
            Error::NotWinner => b"PositionDidNotWin".to_vec(),
            Error::NoTokens => b"NoWinningTokens".to_vec(),
            Error::InsufficientBalance => b"InsufficientBalance".to_vec(),
            Error::ZeroAmount => b"ZeroAmount".to_vec(),
            Error::TransferToZero => b"TransferToZeroAddress".to_vec(),
        }
    }
}

#[public]
impl BinaryRouter {
    pub fn initialize(&mut self, owner: Address) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO { return Err(b"Already initialized".to_vec()); }
        self.owner.set(owner);
        Ok(())
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.pending_owner.set(new_owner);
        Ok(())
    }

    pub fn accept_ownership(&mut self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.pending_owner.get() { return Err(Error::Unauthorized.into()); }
        self.owner.set(self.pending_owner.get());
        self.pending_owner.set(Address::ZERO);
        Ok(())
    }

    pub fn set_amm_address(&mut self, addr: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.amm_address.set(addr);
        Ok(())
    }

    pub fn set_usdc_token(&mut self, token: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.usdc_token.set(token);
        Ok(())
    }

    /// Set the market ID — called by factory during creation.
    pub fn set_market_id(&mut self, id: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.market_id.set(id);
        Ok(())
    }

    pub fn get_market_id(&self) -> Result<U256, Vec<u8>> {
        Ok(self.market_id.get())
    }

    pub fn get_amm_address(&self) -> Result<Address, Vec<u8>> {
        Ok(self.amm_address.get())
    }

    // ─── ERC-1155 Interface ────────────────────────────────────────────

    /// ERC-1155: Get balance of a specific token for an account
    pub fn balance_of(&self, account: Address, id: U256) -> Result<U256, Vec<u8>> {
        Ok(self.staker_balances.getter(account).get(id))
    }

    /// ERC-1155: Get balances of multiple (account, id) pairs
    pub fn balance_of_batch(&self, accounts: Vec<Address>, ids: Vec<U256>) -> Result<Vec<U256>, Vec<u8>> {
        if accounts.len() != ids.len() { return Err(b"Length mismatch".to_vec()); }
        let mut results = Vec::with_capacity(accounts.len());
        for i in 0..accounts.len() {
            results.push(self.staker_balances.getter(accounts[i]).get(ids[i]));
        }
        Ok(results)
    }

    /// ERC-1155: Set approval for an operator to manage all of caller's tokens
    pub fn set_approval_for_all(&mut self, operator: Address, approved: bool) -> Result<(), Vec<u8>> {
        let caller = self.vm().msg_sender();
        if caller == operator { return Err(b"Self approval".to_vec()); }
        self.operator_approvals.setter(caller).setter(operator).set(approved);
        self.vm().log(ApprovalForAll { account: caller, operator, approved });
        Ok(())
    }

    /// ERC-1155: Check if operator is approved for all of owner's tokens
    pub fn is_approved_for_all(&self, account: Address, operator: Address) -> Result<bool, Vec<u8>> {
        Ok(self.operator_approvals.getter(account).get(operator))
    }

    /// ERC-1155: Transfer tokens from one address to another
    pub fn safe_transfer_from(
        &mut self,
        from: Address,
        to: Address,
        id: U256,
        amount: U256,
        _data: Vec<u8>,
    ) -> Result<(), Vec<u8>> {
        if to == Address::ZERO { return Err(Error::TransferToZero.into()); }
        let caller = self.vm().msg_sender();
        if caller != from && !self.operator_approvals.getter(from).get(caller) {
            return Err(Error::Unauthorized.into());
        }

        let from_balance = self.staker_balances.getter(from).get(id);
        if from_balance < amount { return Err(Error::InsufficientBalance.into()); }

        self.staker_balances.setter(from).setter(id).set(from_balance - amount);
        let to_balance = self.staker_balances.getter(to).get(id);
        self.staker_balances.setter(to).setter(id).set(to_balance + amount);

        self.vm().log(TransferSingle { operator: caller, from, to, id, value: amount });
        Ok(())
    }

    /// ERC-1155: supportsInterface — returns true for ERC-1155 (0xd9b67a26) and ERC-165 (0x01ffc9a7)
    pub fn supports_interface(&self, interface_id: FixedBytes<4>) -> Result<bool, Vec<u8>> {
        let erc1155_id: [u8; 4] = [0xd9, 0xb6, 0x7a, 0x26];
        let erc165_id: [u8; 4] = [0x01, 0xff, 0xc9, 0xa7];
        let id_bytes: [u8; 4] = interface_id.into();
        Ok(id_bytes == erc1155_id || id_bytes == erc165_id)
    }

    // ─── Trading Functions ─────────────────────────────────────────────

    /// C3: User inputs USDC stake amount (6 decimals). Platform computes tokens.
    /// C2: Fee is 1% of stake_amount.
    /// H4+M1: Token ID is keccak256(market_id, target_x, is_yes).
    pub fn buy_yes(&mut self, target_price: I256, stake_usdc: U256) -> Result<(), Vec<u8>> {
        if stake_usdc == U256::ZERO { return Err(Error::ZeroAmount.into()); }
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.buy_internal(target_price, stake_usdc, true);
        self.locked.set(false);
        res
    }

    /// C3: User inputs USDC stake amount (6 decimals). Platform computes tokens.
    pub fn buy_no(&mut self, target_price: I256, stake_usdc: U256) -> Result<(), Vec<u8>> {
        if stake_usdc == U256::ZERO { return Err(Error::ZeroAmount.into()); }
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.buy_internal(target_price, stake_usdc, false);
        self.locked.set(false);
        res
    }

    // ─── Settlement (H6 — pull-based) ──────────────────────────────────

    /// Owner sets the final price when the market closes.
    /// No on-chain resolution — users claim individually via claim_winnings.
    pub fn set_final_price(&mut self, price: I256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        if self.market_resolved.get() { return Err(b"Already resolved".to_vec()); }
        self.final_price.set(price);
        self.market_resolved.set(true);
        self.vm().log(MarketResolved { final_price: price });
        Ok(())
    }

    /// H4: Pull-based claim_winnings. User specifies their target_x and direction.
    /// The contract checks if their position won, recreates their token_id,
    /// burns the tokens, and pays 1 USDC per token.
    pub fn claim_winnings(&mut self, target_x: I256, is_yes: bool) -> Result<(), Vec<u8>> {
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.claim_winnings_internal(target_x, is_yes);
        self.locked.set(false);
        res
    }

    /// Query: is a position resolved and is the market resolved
    pub fn is_market_resolved(&self) -> Result<bool, Vec<u8>> {
        Ok(self.market_resolved.get())
    }

    pub fn get_final_price(&self) -> Result<I256, Vec<u8>> {
        Ok(self.final_price.get())
    }

    /// Permissionless: release collateral locked for a losing position.
    /// Anyone can call this after resolution to free LP capital.
    pub fn release_losing_collateral(&mut self, target_x: I256, is_yes: bool) -> Result<(), Vec<u8>> {
        if !self.market_resolved.get() { return Err(Error::NotResolved.into()); }
        let final_price = self.final_price.get();
        
        let is_winner = if is_yes { final_price >= target_x } else { final_price < target_x };
        if is_winner { return Err(b"Position is winning".to_vec()); }
        
        let token_id = self.derive_token_id(target_x, is_yes);
        
        let amm = IDistributionAmm::new(self.amm_address.get());
        let config = Call::new_mutating(&mut *self);
        amm.release_collateral(self.vm(), config, token_id).map_err(|_| Error::AmmCallFailed)?;
        
        Ok(())
    }

    /// Helper: compute the token_id for a given target and direction
    pub fn compute_token_id(&self, target_x: I256, is_yes: bool) -> Result<U256, Vec<u8>> {
        Ok(self.derive_token_id(target_x, is_yes))
    }
}

impl BinaryRouter {
    /// Derive a unique ERC-1155 token_id from (market_id, target_x, is_yes)
    /// using keccak256 hash.
    fn derive_token_id(&self, target_x: I256, is_yes: bool) -> U256 {
        let market_id = self.market_id.get();
        // Pack: market_id (32 bytes) + target_x (32 bytes) + is_yes (1 byte)
        let mut data = [0u8; 65];
        let market_bytes: [u8; 32] = market_id.to_be_bytes();
        data[0..32].copy_from_slice(&market_bytes);
        let target_bytes: [u8; 32] = U256::from(target_x.into_raw()).to_be_bytes();
        data[32..64].copy_from_slice(&target_bytes);
        data[64] = if is_yes { 1 } else { 0 };
        
        let hash = stylus_sdk::crypto::keccak(data);
        U256::from_be_bytes(hash.0)
    }

    /// Unified buy logic for both YES and NO.
    /// C3: User inputs stake_usdc (USDC 6-decimal amount).
    /// C2: 1% fee on stake amount. Tokens = net_stake / price.
    fn buy_internal(&mut self, target_price: I256, stake_usdc: U256, is_yes: bool) -> Result<(), Vec<u8>> {
        let amm = IDistributionAmm::new(self.amm_address.get());
        
        let config_mu = Call::new();
        let mu = amm.global_mu(self.vm(), config_mu).map_err(|_| Error::AmmCallFailed)?;
        
        let config_sigma = Call::new();
        let sigma = amm.global_sigma(self.vm(), config_sigma).map_err(|_| Error::AmmCallFailed)?;
        
        // Compute price from CDF
        let p_no = normal_cdf(target_price, mu, sigma);
        let price = if is_yes { wad() - p_no } else { p_no };
        
        // C4: safe conversion — price should always be in [0, WAD]
        let price_u256 = safe_to_u256(price);
        
        // Require price > 0 to avoid division by zero
        if price_u256 == U256::ZERO { return Err(b"Price is zero".to_vec()); }
        
        // C3: Convert USDC input (6 decimals) to WAD (18 decimals)
        let stake_wad = stake_usdc * U256::from(1_000_000_000_000u128);
        
        // C2: Fee = 1% of stake
        let fee_wad = stake_wad / U256::from(100u64);
        let net_stake_wad = stake_wad - fee_wad;
        
        // Tokens minted = net_stake / price
        // Both are in WAD, so: tokens = net_stake * WAD / price
        let tokens_minted_wad = (net_stake_wad * U256::from(1_000_000_000_000_000_000u128)) / price_u256;
        
        if tokens_minted_wad == U256::ZERO { return Err(b"Zero tokens".to_vec()); }
        
        // Transfer the full stake_usdc from user to AMM
        let usdc = IERC20::new(self.usdc_token.get());
        let user = self.vm().msg_sender();
        
        let config_usdc = Call::new_mutating(&mut *self);
        if !usdc.transfer_from(self.vm(), config_usdc, user, self.amm_address.get(), stake_usdc).map_err(|_| Error::UsdcTransferFailed)? {
            return Err(Error::UsdcTransferFailed.into());
        }

        // H4+M1: Derive unique token_id from (market_id, target_x, is_yes)
        let token_id = self.derive_token_id(target_price, is_yes);
        
        // Distribute fee to LPs
        let config_fee = Call::new_mutating(&mut *self);
        amm.distribute_fee(self.vm(), config_fee, fee_wad).map_err(|_| Error::AmmCallFailed)?;
        
        // Underwrite the trade: premium = net_stake, liability = tokens_minted.
        // target_price (the strike) is passed so the AMM can fold this bet into the
        // stake-weighted curve (weight = net_stake, x = strike). Pricing above used
        // the pre-update μ/σ; the curve shifts only after the trade is underwritten.
        let config_trade = Call::new_mutating(&mut *self);
        amm.underwrite_trade(self.vm(), config_trade, token_id, target_price, net_stake_wad, tokens_minted_wad).map_err(|_| Error::AmmCallFailed)?;

        // Mint tokens to user
        let mut user_balances = self.staker_balances.setter(user);
        let current = user_balances.get(token_id);
        user_balances.setter(token_id).set(current + tokens_minted_wad);

        // Update token supply
        let current_supply = self.token_supplies.getter(token_id).get();
        self.token_supplies.setter(token_id).set(current_supply + tokens_minted_wad);

        // Events
        self.vm().log(TradeExecuted { user, token_id, target_price, is_yes, tokens_minted: tokens_minted_wad });
        self.vm().log(TransferSingle { operator: user, from: Address::ZERO, to: user, id: token_id, value: tokens_minted_wad });
        
        Ok(())
    }

    /// H4: Pull-based claiming. Each user claims for their specific (target_x, direction).
    fn claim_winnings_internal(&mut self, target_x: I256, is_yes: bool) -> Result<(), Vec<u8>> {
        // 1. Ensure market is resolved
        if !self.market_resolved.get() { return Err(Error::NotResolved.into()); }
        let final_price = self.final_price.get();

        // 2. Check if this specific position won
        let is_winner = if is_yes {
            final_price >= target_x
        } else {
            final_price < target_x
        };
        if !is_winner { return Err(Error::NotWinner.into()); }

        // 3. Recreate their specific token_id
        let token_id = self.derive_token_id(target_x, is_yes);
        let user = self.vm().msg_sender();
        let user_balance = self.staker_balances.getter(user).get(token_id);
        if user_balance == U256::ZERO { return Err(Error::NoTokens.into()); }

        // 4. Burn tokens
        self.staker_balances.setter(user).setter(token_id).set(U256::ZERO);
        let current_supply = self.token_supplies.getter(token_id).get();
        self.token_supplies.setter(token_id).set(current_supply - user_balance);

        self.vm().log(TransferSingle { operator: user, from: user, to: Address::ZERO, id: token_id, value: user_balance });

        // 5. Pay 1 USDC per token (convert WAD to USDC 6 decimals)
        let payout_usdc = user_balance / U256::from(1_000_000_000_000u128);
        
        if payout_usdc > U256::ZERO {
            // Pay from AMM via payout_winnings
            let amm = IDistributionAmm::new(self.amm_address.get());
            let config = Call::new_mutating(&mut *self);
            amm.payout_winnings(self.vm(), config, user, token_id, user_balance).map_err(|_| Error::AmmCallFailed)?;
        }

        self.vm().log(WinningsClaimed { user, token_id, amount: user_balance });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::testing::*;
    use alloy_sol_types::{sol as test_sol, SolCall};

    // Local ABI mirror of the AMM / ERC-20 calls the router makes, used only to
    // construct exact mock calldata. Signatures must match `interfaces.rs` /
    // `IDistributionAmm` so selectors line up with what the router emits.
    test_sol! {
        function globalMu() external view returns (int256);
        function globalSigma() external view returns (int256);
        function distributeFee(uint256 fee_amount) external;
        function underwriteTrade(uint256 token_id, int256 target_x, uint256 premium_wad, uint256 max_liability_wad) external;
        function payoutWinnings(address user, uint256 token_id, uint256 amount_wad) external;
        function releaseCollateral(uint256 token_id) external;
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
    }

    fn addr(n: u8) -> Address { Address::from([n; 20]) }
    fn enc_word(bytes: [u8; 32]) -> Vec<u8> { bytes.to_vec() }
    fn enc_i256(v: I256) -> Vec<u8> { enc_word(v.to_be_bytes::<32>()) }
    fn enc_bool(b: bool) -> Vec<u8> { let mut w = [0u8; 32]; if b { w[31] = 1; } w.to_vec() }

    const AMM: u8 = 0xAA;
    const USDC: u8 = 0xCC;

    /// Initialized router wired to mock AMM + USDC, owned by `owner`.
    fn setup(vm: &TestVM, owner: Address) -> BinaryRouter {
        let mut router = BinaryRouter::from(vm);
        vm.set_sender(owner);
        router.initialize(owner).unwrap();
        router.set_amm_address(addr(AMM)).unwrap();
        router.set_usdc_token(addr(USDC)).unwrap();
        router
    }

    // ── Init / ownership / config ─────────────────────────────────────

    #[test]
    fn initialize_twice_reverts() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        assert_eq!(router.initialize(addr(2)).unwrap_err(), b"Already initialized".to_vec());
    }

    #[test]
    fn config_setters_are_owner_only() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(9));
        assert_eq!(router.set_amm_address(addr(2)).unwrap_err(), b"Unauthorized".to_vec());
        assert_eq!(router.set_usdc_token(addr(2)).unwrap_err(), b"Unauthorized".to_vec());
        assert_eq!(router.set_market_id(U256::from(1u8)).unwrap_err(), b"Unauthorized".to_vec());
    }

    #[test]
    fn ownership_transfer_is_two_step() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(1));
        router.transfer_ownership(addr(2)).unwrap();
        // Not yet effective.
        vm.set_sender(addr(2));
        assert_eq!(router.set_amm_address(addr(3)).unwrap_err(), b"Unauthorized".to_vec());
        router.accept_ownership().unwrap();
        // Now effective.
        router.set_amm_address(addr(3)).unwrap();
        assert_eq!(router.get_amm_address().unwrap(), addr(3));
    }

    #[test]
    fn market_id_roundtrips() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(1));
        router.set_market_id(U256::from(42u64)).unwrap();
        assert_eq!(router.get_market_id().unwrap(), U256::from(42u64));
    }

    // ── token_id derivation ───────────────────────────────────────────

    #[test]
    fn token_id_is_deterministic_and_distinct() {
        let vm = TestVM::default();
        let router = setup(&vm, addr(1));
        let x = I256::try_from(1234i64).unwrap();
        let yes = router.compute_token_id(x, true).unwrap();
        let yes_again = router.compute_token_id(x, true).unwrap();
        let no = router.compute_token_id(x, false).unwrap();
        let other_x = router.compute_token_id(I256::try_from(1235i64).unwrap(), true).unwrap();
        assert_eq!(yes, yes_again, "same inputs → same id");
        assert_ne!(yes, no, "direction changes id");
        assert_ne!(yes, other_x, "strike changes id");
    }

    #[test]
    fn token_id_depends_on_market_id() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let x = I256::try_from(1234i64).unwrap();
        vm.set_sender(addr(1));
        router.set_market_id(U256::from(0u8)).unwrap();
        let id0 = router.compute_token_id(x, true).unwrap();
        router.set_market_id(U256::from(1u8)).unwrap();
        let id1 = router.compute_token_id(x, true).unwrap();
        assert_ne!(id0, id1, "market_id is part of the id preimage");
    }

    // ── ERC-1155 surface ──────────────────────────────────────────────

    #[test]
    fn supports_interface_erc1155_and_erc165() {
        let vm = TestVM::default();
        let router = setup(&vm, addr(1));
        assert!(router.supports_interface(FixedBytes::from([0xd9, 0xb6, 0x7a, 0x26])).unwrap());
        assert!(router.supports_interface(FixedBytes::from([0x01, 0xff, 0xc9, 0xa7])).unwrap());
        assert!(!router.supports_interface(FixedBytes::from([0x12, 0x34, 0x56, 0x78])).unwrap());
    }

    #[test]
    fn approval_for_all_and_self_approval_guard() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let owner = addr(5);
        let op = addr(6);
        vm.set_sender(owner);
        assert_eq!(router.set_approval_for_all(owner, true).unwrap_err(), b"Self approval".to_vec());
        router.set_approval_for_all(op, true).unwrap();
        assert!(router.is_approved_for_all(owner, op).unwrap());
        router.set_approval_for_all(op, false).unwrap();
        assert!(!router.is_approved_for_all(owner, op).unwrap());
    }

    #[test]
    fn balance_of_batch_length_mismatch_reverts() {
        let vm = TestVM::default();
        let router = setup(&vm, addr(1));
        let accounts = alloc::vec![addr(1), addr(2)];
        let ids = alloc::vec![U256::ZERO];
        assert_eq!(router.balance_of_batch(accounts, ids).unwrap_err(), b"Length mismatch".to_vec());
    }

    #[test]
    fn safe_transfer_from_validations() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let from = addr(5);
        let to = addr(6);
        let id = U256::from(1u8);

        // to == zero
        vm.set_sender(from);
        assert_eq!(
            router.safe_transfer_from(from, Address::ZERO, id, U256::from(1u8), alloc::vec![]).unwrap_err(),
            b"TransferToZeroAddress".to_vec()
        );

        // not owner / not approved operator
        vm.set_sender(addr(9));
        assert_eq!(
            router.safe_transfer_from(from, to, id, U256::from(1u8), alloc::vec![]).unwrap_err(),
            b"Unauthorized".to_vec()
        );

        // insufficient balance (from has none)
        vm.set_sender(from);
        assert_eq!(
            router.safe_transfer_from(from, to, id, U256::from(1u8), alloc::vec![]).unwrap_err(),
            b"InsufficientBalance".to_vec()
        );
    }

    // ── Trade guards (no mocks needed) ────────────────────────────────

    #[test]
    fn buy_rejects_zero_stake() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(5));
        assert_eq!(router.buy_yes(I256::ZERO, U256::ZERO).unwrap_err(), b"ZeroAmount".to_vec());
        assert_eq!(router.buy_no(I256::ZERO, U256::ZERO).unwrap_err(), b"ZeroAmount".to_vec());
    }

    // ── Happy-path trade (mocked AMM + USDC) ──────────────────────────
    //
    // TestVM note: all mocked external calls return one shared return-data
    // buffer (the most-recently registered mock's bytes); the per-mock
    // (to, calldata) key only decides success-vs-revert. So a single global
    // buffer must satisfy *every* read in the call path. We set it to the
    // 32-byte word `1`, which the router reads as μ=σ=1 (wei) for the two
    // `globalMu`/`globalSigma` views and as `true` for the USDC `transferFrom`.
    // void calls (distributeFee/underwriteTrade) ignore the buffer. The expected
    // token amount is derived from the contract's own `math_core`, so the test
    // asserts the router's bookkeeping (tokens = net_stake/price), not the maths.

    fn wad_i256() -> I256 { I256::try_from(1_000_000_000_000_000_000i128).unwrap() }

    #[test]
    fn buy_yes_happy_path_mints_tokens() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let user = addr(5);

        let target = I256::ZERO;
        let mu = I256::ONE;
        let sigma = I256::ONE;

        // Expected price/tokens via the contract's own math (yes price = 1 - CDF).
        let p_no = crate::math_core::normal_cdf(target, mu, sigma);
        let price_u256 = crate::math_core::safe_to_u256(wad_i256() - p_no);
        assert!(price_u256 > U256::ZERO);

        let stake_usdc = U256::from(1_000_000u64);              // 1 USDC
        let stake_wad = stake_usdc * U256::from(1_000_000_000_000u128);
        let fee_wad = stake_wad / U256::from(100u64);
        let net_stake_wad = stake_wad - fee_wad;
        let tokens = (net_stake_wad * U256::from(1_000_000_000_000_000_000u128)) / price_u256;
        assert!(tokens > U256::ZERO);

        let token_id = router.compute_token_id(target, true).unwrap();

        // Set the shared return buffer to the word `1` (true / μ=σ=1) by making
        // this the last-registered mock. All other matched mocks succeed too.
        vm.mock_call(addr(AMM), distributeFeeCall { fee_amount: fee_wad }.abi_encode(), U256::ZERO, Ok(alloc::vec![]));
        vm.mock_call(
            addr(AMM),
            underwriteTradeCall { token_id, target_x: target, premium_wad: net_stake_wad, max_liability_wad: tokens }.abi_encode(),
            U256::ZERO,
            Ok(alloc::vec![]),
        );
        vm.mock_static_call(addr(AMM), globalMuCall {}.abi_encode(), Ok(enc_i256(mu)));
        vm.mock_static_call(addr(AMM), globalSigmaCall {}.abi_encode(), Ok(enc_i256(sigma)));
        vm.mock_call(
            addr(USDC),
            transferFromCall { from: user, to: addr(AMM), amount: stake_usdc }.abi_encode(),
            U256::ZERO,
            Ok(enc_bool(true)),
        );

        vm.set_sender(user);
        router.buy_yes(target, stake_usdc).unwrap();

        // Bookkeeping: the position balance equals net_stake/price.
        assert_eq!(router.balance_of(user, token_id).unwrap(), tokens);
        // A second identical buy accumulates into the same position id.
        router.buy_yes(target, stake_usdc).unwrap();
        assert_eq!(router.balance_of(user, token_id).unwrap(), tokens + tokens);
    }

    #[test]
    fn buy_propagates_usdc_transfer_failure() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let user = addr(5);
        let target = I256::ZERO;
        let stake_usdc = U256::from(1_000_000u64);

        // transferFrom is registered last → shared buffer = false (word 0), which
        // also makes the μ/σ reads return 0 (σ=0 ⇒ CDF=0 ⇒ yes price = 1 WAD,
        // nonzero, so the path reaches the transfer). The false result must then
        // surface as UsdcTransferFailed.
        vm.mock_static_call(addr(AMM), globalMuCall {}.abi_encode(), Ok(enc_i256(I256::ZERO)));
        vm.mock_static_call(addr(AMM), globalSigmaCall {}.abi_encode(), Ok(enc_i256(I256::ZERO)));
        vm.mock_call(
            addr(USDC),
            transferFromCall { from: user, to: addr(AMM), amount: stake_usdc }.abi_encode(),
            U256::ZERO,
            Ok(enc_bool(false)),
        );

        vm.set_sender(user);
        assert_eq!(router.buy_yes(target, stake_usdc).unwrap_err(), b"UsdcTransferFailed".to_vec());
    }

    // ── Settlement ────────────────────────────────────────────────────

    #[test]
    fn set_final_price_owner_only_and_single_shot() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let price = I256::try_from(2000i64).unwrap();

        vm.set_sender(addr(9));
        assert_eq!(router.set_final_price(price).unwrap_err(), b"Unauthorized".to_vec());

        vm.set_sender(addr(1));
        router.set_final_price(price).unwrap();
        assert!(router.is_market_resolved().unwrap());
        assert_eq!(router.get_final_price().unwrap(), price);

        // Cannot resolve twice.
        assert_eq!(router.set_final_price(price).unwrap_err(), b"Already resolved".to_vec());
    }

    #[test]
    fn claim_winnings_requires_resolution() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(5));
        assert_eq!(router.claim_winnings(I256::ZERO, true).unwrap_err(), b"MarketNotResolved".to_vec());
    }

    #[test]
    fn claim_winnings_rejects_losing_position() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(1));
        // final = 1000; a YES at strike 2000 loses (final < strike).
        router.set_final_price(I256::try_from(1000i64).unwrap()).unwrap();
        vm.set_sender(addr(5));
        assert_eq!(
            router.claim_winnings(I256::try_from(2000i64).unwrap(), true).unwrap_err(),
            b"PositionDidNotWin".to_vec()
        );
    }

    #[test]
    fn claim_winnings_winner_without_tokens_reverts() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(1));
        // final = 3000; a YES at strike 2000 wins (final >= strike) but holder has none.
        router.set_final_price(I256::try_from(3000i64).unwrap()).unwrap();
        vm.set_sender(addr(5));
        assert_eq!(
            router.claim_winnings(I256::try_from(2000i64).unwrap(), true).unwrap_err(),
            b"NoWinningTokens".to_vec()
        );
    }

    #[test]
    fn release_losing_collateral_requires_resolution() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        assert_eq!(
            router.release_losing_collateral(I256::ZERO, true).unwrap_err(),
            b"MarketNotResolved".to_vec()
        );
    }

    #[test]
    fn release_losing_collateral_rejects_winning_position() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        vm.set_sender(addr(1));
        // final = 3000; YES at 2000 is winning → cannot release.
        router.set_final_price(I256::try_from(3000i64).unwrap()).unwrap();
        assert_eq!(
            router.release_losing_collateral(I256::try_from(2000i64).unwrap(), true).unwrap_err(),
            b"Position is winning".to_vec()
        );
    }

    #[test]
    fn release_losing_collateral_calls_amm_for_loser() {
        let vm = TestVM::default();
        let mut router = setup(&vm, addr(1));
        let strike = I256::try_from(2000i64).unwrap();
        vm.set_sender(addr(1));
        // final = 1000; YES at 2000 lost → router frees its collateral via the AMM.
        router.set_final_price(I256::try_from(1000i64).unwrap()).unwrap();
        let token_id = router.compute_token_id(strike, true).unwrap();
        vm.mock_call(
            addr(AMM),
            releaseCollateralCall { token_id }.abi_encode(),
            U256::ZERO,
            Ok(alloc::vec![]),
        );
        vm.set_sender(addr(7)); // permissionless
        router.release_losing_collateral(strike, true).unwrap();
    }
}
