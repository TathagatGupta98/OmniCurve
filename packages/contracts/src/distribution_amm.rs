use alloy_primitives::{I256, U256, Address};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;
use alloc::vec::Vec;
use alloc::vec;

extern crate alloc;

use crate::interfaces::{IERC20, ILpToken};
use crate::math_core::{normal_cdf, safe_to_u256, wad_mul, sqrt_wad};

#[inline(always)] fn wad() -> I256 { I256::try_from(1_000_000_000_000_000_000i128).unwrap() }

sol! {
    event CurveUpdated(uint256 indexed new_mu, uint256 indexed new_sigma);
    event LiquidityAdded(address indexed provider, uint256 amount_wad);
    event LiquidityRemoved(address indexed provider, uint256 amount_wad);
    event WinningsClaimed(address indexed user, uint256 amount_wad);
    event MarketResolved(uint256 indexed winning_id);
    event FeeDistributed(uint256 amount_wad);
    event TradesStarted();
}

sol_storage! {
    #[entrypoint]
    pub struct DistributionAmm {
        address owner;
        address pending_owner;
        int256 global_mu;
        int256 global_sigma;
        int256 sigma_min;
        int256 available_liquidity;
        int256 locked_collateral;
        address usdc_token;
        address router_address;
        address lp_token_address;
        int256 acc_fee_per_share;
        mapping(address => int256) reward_debt;
        bool is_resolved;
        uint256 winning_token_id;
        
        bool trades_started;
        uint256 resolution_time;
        uint256 proposed_winning_id;

        mapping(uint256 => int256) token_liabilities;

        // C5: Reentrancy guard
        bool locked;
    }
}

pub enum Error {
    VarianceTooLow,
    UsdcTransferFailed,
    Unauthorized,
    InsufficientLiquidity,
    Overflow,
    LpTokenCallFailed,
    Reentrancy,
    TradesAlreadyStarted,
    NegativeValue,
}

impl From<Error> for Vec<u8> {
    fn from(e: Error) -> Self {
        match e {
            Error::VarianceTooLow => b"VarianceTooLow".to_vec(),
            Error::UsdcTransferFailed => b"UsdcTransferFailed".to_vec(),
            Error::Unauthorized => b"Unauthorized".to_vec(),
            Error::InsufficientLiquidity => b"InsufficientLiquidity".to_vec(),
            Error::Overflow => b"Overflow".to_vec(),
            Error::LpTokenCallFailed => b"LpTokenCallFailed".to_vec(),
            Error::Reentrancy => b"Reentrancy".to_vec(),
            Error::TradesAlreadyStarted => b"TradesAlreadyStarted".to_vec(),
            Error::NegativeValue => b"NegativeValue".to_vec(),
        }
    }
}

#[public]
impl DistributionAmm {
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

    pub fn global_mu(&self) -> Result<I256, Vec<u8>> { Ok(self.global_mu.get()) }
    pub fn global_sigma(&self) -> Result<I256, Vec<u8>> { Ok(self.global_sigma.get()) }

    pub fn set_usdc_token(&mut self, token: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.usdc_token.set(token);
        Ok(())
    }

    pub fn set_router_address(&mut self, addr: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.router_address.set(addr);
        Ok(())
    }

    pub fn set_lp_token(&mut self, addr: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.lp_token_address.set(addr);
        Ok(())
    }

    pub fn lp_token(&self) -> Result<Address, Vec<u8>> { Ok(self.lp_token_address.get()) }

    // M4: Validate sigma_min > 0
    pub fn set_sigma_min(&mut self, min: I256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        if min <= I256::ZERO { return Err(Error::VarianceTooLow.into()); }
        self.sigma_min.set(min);
        Ok(())
    }

    pub fn set_distribution(&mut self, mu: I256, sigma: I256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        // H2: Clear error when trades have started
        if self.trades_started.get() { return Err(Error::TradesAlreadyStarted.into()); }
        if sigma <= self.sigma_min.get() { return Err(Error::VarianceTooLow.into()); }
        self.global_mu.set(mu);
        self.global_sigma.set(sigma);
        self.vm().log(CurveUpdated { new_mu: safe_to_u256(mu), new_sigma: safe_to_u256(sigma) });
        Ok(())
    }

    pub fn get_price_for_x(&self, x: I256, is_yes: bool) -> Result<I256, Vec<u8>> {
        let mu = self.global_mu.get();
        let sigma = self.global_sigma.get();
        let cdf = normal_cdf(x, mu, sigma);
        if is_yes { Ok(wad() - cdf) } else { Ok(cdf) }
    }

    // NOTE: fee_amount is in WAD (1e18). The corresponding USDC (1e6) was already
    // transferred to this contract by the router before this call. The 1e12 scaling
    // difference is intentional; sweep_dust() recovers any rounding remainder.
    //
    // H1: Fee distribution now uses available_liquidity instead of LP totalSupply.
    pub fn distribute_fee(&mut self, fee_amount: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.router_address.get() { return Err(Error::Unauthorized.into()); }
        
        let avail_liq = self.available_liquidity.get();

        if avail_liq > I256::ZERO {
            let fee_i256 = I256::try_from(fee_amount).map_err(|_| Error::Overflow)?;
            let current_acc = self.acc_fee_per_share.get();
            // H1: Use available_liquidity (L) as denominator per spec: S ← S + f / L
            let inc = (fee_i256 * wad()) / avail_liq;
            self.acc_fee_per_share.set(current_acc + inc);
            self.available_liquidity.set(avail_liq + fee_i256);
            self.vm().log(FeeDistributed { amount_wad: fee_amount });
        }
        Ok(())
    }

    // H5: Fixed WAD→USDC conversion (was missing / 1e12)
    // C5: Reentrancy guarded
    pub fn claim_fees(&mut self) -> Result<(), Vec<u8>> {
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.claim_fees_internal();
        self.locked.set(false);
        res
    }

    // M7: Variance-weighted σ combination + M6: Round-up USDC transfer
    // C5: Reentrancy guarded
    pub fn add_liquidity(&mut self, amount_wad: U256, target_mu: I256, target_sigma: I256) -> Result<(), Vec<u8>> {
        if target_sigma <= self.sigma_min.get() { return Err(Error::VarianceTooLow.into()); }
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.add_liquidity_internal(amount_wad, target_mu, target_sigma);
        self.locked.set(false);
        res
    }

    // H3: Fixed solvency check
    // C5: Reentrancy guarded
    pub fn remove_liquidity(&mut self, shares_to_remove: U256) -> Result<(), Vec<u8>> {
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.remove_liquidity_internal(shares_to_remove);
        self.locked.set(false);
        res
    }

    pub fn underwrite_trade(&mut self, token_id: U256, premium_wad: U256, max_liability_wad: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.router_address.get() { return Err(Error::Unauthorized.into()); }
        if !self.trades_started.get() {
            self.trades_started.set(true);
            self.vm().log(TradesStarted {});
        }
        let premium_i256 = I256::try_from(premium_wad).map_err(|_| Error::Overflow)?;
        let liability_i256 = I256::try_from(max_liability_wad).map_err(|_| Error::Overflow)?;
        
        let pre_liquidity = self.available_liquidity.get();
        if pre_liquidity < liability_i256 {
            return Err(Error::InsufficientLiquidity.into());
        }
        
        self.available_liquidity.set(pre_liquidity + premium_i256 - liability_i256);
        self.locked_collateral.set(self.locked_collateral.get() + liability_i256);
        
        let mut tl = self.token_liabilities.setter(token_id);
        let current_tl = tl.get();
        tl.set(current_tl + liability_i256);
        
        Ok(())
    }

    pub fn propose_resolution(&mut self, winning_id: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.router_address.get() { return Err(Error::Unauthorized.into()); }
        if self.is_resolved.get() { return Err(b"Already resolved".to_vec()); }
        if self.resolution_time.get() > U256::ZERO { return Err(b"Already proposed".to_vec()); }

        self.proposed_winning_id.set(winning_id);
        self.resolution_time.set(U256::from(self.vm().block_timestamp() + 86400));
        Ok(())
    }

    pub fn cancel_resolution(&mut self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        if self.is_resolved.get() { return Err(b"Already finalised".to_vec()); }
        self.resolution_time.set(U256::ZERO);
        self.proposed_winning_id.set(U256::ZERO);
        Ok(())
    }

    pub fn execute_resolution(&mut self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        if self.is_resolved.get() { return Err(b"Already resolved".to_vec()); }
        let res_time = self.resolution_time.get();
        if res_time == U256::ZERO || U256::from(self.vm().block_timestamp()) < res_time { 
            return Err(b"Time-lock active".to_vec()); 
        }

        self.is_resolved.set(true);
        let winning_id = self.proposed_winning_id.get();
        self.winning_token_id.set(winning_id);

        let total_locked = self.locked_collateral.get();
        let winning_liability = self.token_liabilities.getter(winning_id).get();
        
        let release = total_locked - winning_liability;
        self.available_liquidity.set(self.available_liquidity.get() + release);
        self.locked_collateral.set(winning_liability);

        self.vm().log(MarketResolved { winning_id });

        Ok(())
    }

    // C5: Reentrancy guarded
    pub fn payout_winnings(&mut self, user: Address, token_id: U256, amount_wad: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.router_address.get() { return Err(Error::Unauthorized.into()); }
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.payout_winnings_internal(user, token_id, amount_wad);
        self.locked.set(false);
        res
    }

    // M5: Capped sweep_dust
    // C5: Reentrancy guarded
    pub fn sweep_dust(&mut self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        if self.locked.get() { return Err(Error::Reentrancy.into()); }
        self.locked.set(true);
        let res = self.sweep_dust_internal();
        self.locked.set(false);
        res
    }
}

impl DistributionAmm {
    // H5: Fixed — now divides by 1e12 before USDC transfer
    fn claim_fees_internal(&mut self) -> Result<(), Vec<u8>> {
        let user = self.vm().msg_sender();
        
        let lp_token = ILpToken::new(self.lp_token_address.get());
        let shares_u256 = lp_token.balance_of(self.vm(), Call::new(), user).map_err(|_| Error::LpTokenCallFailed)?;
        let shares = I256::try_from(shares_u256).map_err(|_| Error::Overflow)?;

        if shares > I256::ZERO {
            let pending = (shares * self.acc_fee_per_share.get()) / wad() - self.reward_debt.getter(user).get();
            if pending > I256::ZERO {
                self.available_liquidity.set(self.available_liquidity.get() - pending);
                let mut reward_debt = self.reward_debt.setter(user);
                reward_debt.set((shares * self.acc_fee_per_share.get()) / wad());

                // H5: Convert WAD to USDC (divide by 1e12)
                // C4: Use safe_to_u256 instead of into_raw()
                let pending_u256 = safe_to_u256(pending);
                let pending_usdc = pending_u256 / U256::from(1_000_000_000_000u128);
                
                if pending_usdc > U256::ZERO {
                    let usdc = IERC20::new(self.usdc_token.get());
                    let config = Call::new_mutating(&mut *self);
                    if !usdc.transfer(self.vm(), config, user, pending_usdc).map_err(|_| Error::UsdcTransferFailed)? {
                        return Err(Error::UsdcTransferFailed.into());
                    }
                }
            }
        }
        Ok(())
    }

    // M7: Variance-weighted σ combination
    // M6: Round up USDC transfer
    fn add_liquidity_internal(&mut self, amount_wad: U256, target_mu: I256, target_sigma: I256) -> Result<(), Vec<u8>> {
        self.claim_fees_internal()?;

        let amount_i256 = I256::try_from(amount_wad).map_err(|_| Error::Overflow)?;
        
        let old_liquidity = self.available_liquidity.get();
        if !self.trades_started.get() {
            if old_liquidity > I256::ZERO {
                let w_old = (old_liquidity * wad()) / (old_liquidity + amount_i256);
                let w_new = wad() - w_old;
                
                let old_mu = self.global_mu.get();
                let new_mu = (old_mu * w_old) / wad() + (target_mu * w_new) / wad();
                self.global_mu.set(new_mu);
                
                // M7: Variance-weighted σ combination
                // σ²_combined = w_old * σ²_old + w_new * σ²_new + w_old * w_new * (μ_old - μ_new)²
                let old_sigma = self.global_sigma.get();
                let old_var = wad_mul(old_sigma, old_sigma);                        // σ²_old
                let new_var = wad_mul(target_sigma, target_sigma);                  // σ²_new
                let mu_diff = old_mu - target_mu;
                let mu_diff_sq = wad_mul(mu_diff, mu_diff);                        // (μ_old - μ_new)²
                
                let combined_var = wad_mul(w_old, old_var) / wad()
                    + wad_mul(w_new, new_var) / wad()
                    + wad_mul(wad_mul(w_old, w_new) / wad(), mu_diff_sq) / wad();  // Cross term
                
                let combined_sigma = sqrt_wad(combined_var);
                self.global_sigma.set(combined_sigma);
            } else {
                self.global_mu.set(target_mu);
                self.global_sigma.set(target_sigma);
            }
        }

        self.available_liquidity.set(self.available_liquidity.get() + amount_i256);

        let user = self.vm().msg_sender();
        let lp_token = ILpToken::new(self.lp_token_address.get());
        
        let config = Call::new_mutating(&mut *self);
        lp_token.mint(self.vm(), config, user, amount_wad).map_err(|_| Error::LpTokenCallFailed)?;

        let shares_u256 = lp_token.balance_of(self.vm(), Call::new(), user).map_err(|_| Error::LpTokenCallFailed)?;
        let new_shares = I256::try_from(shares_u256).map_err(|_| Error::Overflow)?;

        let mut reward_debt = self.reward_debt.setter(user);
        reward_debt.set((new_shares * self.acc_fee_per_share.get()) / wad());

        // M6: Round UP USDC transfer to prevent depositing 0 USDC but getting LP tokens
        let amount_usdc = (amount_wad + U256::from(999_999_999_999u128)) / U256::from(1_000_000_000_000u128);
        let usdc = IERC20::new(self.usdc_token.get());
        let contract_address = self.vm().contract_address();
        
        let config = Call::new_mutating(&mut *self);
        if !usdc.transfer_from(self.vm(), config, user, contract_address, amount_usdc).map_err(|_| Error::UsdcTransferFailed)? {
            return Err(Error::UsdcTransferFailed.into());
        }

        self.vm().log(LiquidityAdded { provider: user, amount_wad });
        Ok(())
    }

    // H3: Fixed solvency check — available_liquidity - amount >= 0
    fn remove_liquidity_internal(&mut self, shares_to_remove: U256) -> Result<(), Vec<u8>> {
        self.claim_fees_internal()?;

        let shares_i256 = I256::try_from(shares_to_remove).map_err(|_| Error::Overflow)?;
        let user = self.vm().msg_sender();
        
        let amount_to_return = shares_i256;
        // H3: Proper solvency check — remaining available_liquidity must be >= 0
        // (no more arbitrary /10 threshold)
        if self.available_liquidity.get() - amount_to_return < I256::ZERO {
            return Err(Error::InsufficientLiquidity.into());
        }

        let lp_token = ILpToken::new(self.lp_token_address.get());
        let current_shares_u256 = lp_token.balance_of(self.vm(), Call::new(), user).map_err(|_| Error::LpTokenCallFailed)?;
        if current_shares_u256 < shares_to_remove {
            return Err(b"Insufficient shares".to_vec());
        }
        
        let config = Call::new_mutating(&mut *self);
        lp_token.burn(self.vm(), config, user, shares_to_remove).map_err(|_| Error::LpTokenCallFailed)?;
        
        let new_shares_u256 = lp_token.balance_of(self.vm(), Call::new(), user).map_err(|_| Error::LpTokenCallFailed)?;
        let new_shares = I256::try_from(new_shares_u256).map_err(|_| Error::Overflow)?;
        
        self.available_liquidity.set(self.available_liquidity.get() - amount_to_return);

        let mut reward_debt = self.reward_debt.setter(user);
        reward_debt.set((new_shares * self.acc_fee_per_share.get()) / wad());

        let amount_usdc = shares_to_remove / U256::from(1_000_000_000_000u128);
        let usdc = IERC20::new(self.usdc_token.get());
        
        let config = Call::new_mutating(&mut *self);
        if !usdc.transfer(self.vm(), config, user, amount_usdc).map_err(|_| Error::UsdcTransferFailed)? {
            return Err(Error::UsdcTransferFailed.into());
        }

        self.vm().log(LiquidityRemoved { provider: user, amount_wad: shares_to_remove });
        Ok(())
    }

    fn payout_winnings_internal(&mut self, user: Address, token_id: U256, amount_wad: U256) -> Result<(), Vec<u8>> {
        if !self.is_resolved.get() { return Err(b"Market not resolved".to_vec()); }
        if token_id != self.winning_token_id.get() { return Err(b"Token did not win".to_vec()); }

        let amount_i256 = I256::try_from(amount_wad).map_err(|_| Error::Overflow)?;
        if self.locked_collateral.get() < amount_i256 {
            return Err(Error::InsufficientLiquidity.into());
        }

        self.locked_collateral.set(self.locked_collateral.get() - amount_i256);

        let amount_usdc = amount_wad / U256::from(1_000_000_000_000u128);
        let usdc = IERC20::new(self.usdc_token.get());
        
        let config = Call::new_mutating(&mut *self);
        if !usdc.transfer(self.vm(), config, user, amount_usdc).map_err(|_| Error::UsdcTransferFailed)? {
            return Err(Error::UsdcTransferFailed.into());
        }

        self.vm().log(WinningsClaimed { user, amount_wad });
        Ok(())
    }

    // M5: Capped sweep_dust — max 10 USDC
    fn sweep_dust_internal(&mut self) -> Result<(), Vec<u8>> {
        let usdc = IERC20::new(self.usdc_token.get());
        
        let config_bal = Call::new();
        let actual_balance = usdc.balance_of(self.vm(), config_bal, self.vm().contract_address()).map_err(|_| Error::UsdcTransferFailed)?;
        
        let expected_balance_wad = self.available_liquidity.get() + self.locked_collateral.get();
        if expected_balance_wad < I256::ZERO { return Ok(()); }
        
        // C4: safe_to_u256 instead of into_raw()
        let expected_usdc = safe_to_u256(expected_balance_wad) / U256::from(1_000_000_000_000u128);
        if actual_balance > expected_usdc {
            let dust = actual_balance - expected_usdc;
            // M5: Cap sweepable dust at 10 USDC (10_000_000 units) to prevent misuse
            let max_sweep = U256::from(10_000_000u64);
            if dust > U256::from(1_000_000u64) && dust <= max_sweep {
                let config = Call::new_mutating(&mut *self);
                usdc.transfer(self.vm(), config, self.owner.get(), dust).map_err(|_| Error::UsdcTransferFailed)?;
            }
        }
        Ok(())
    }
}
