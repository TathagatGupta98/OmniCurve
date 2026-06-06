use alloy_primitives::{Address, I256, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;
use alloc::vec::Vec;

extern crate alloc;

sol_interface! {
    interface IDistributionAmm {
        function tradeDistribution(int256 target_mu, int256 target_sigma) external returns (int256);
        function globalMu() external view returns (int256);
        function globalSigma() external view returns (int256);
    }
}

sol_interface! {
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }
}

sol! {
    event TradeExecuted(address indexed user, uint256 target_price, bool is_yes);
}

sol_storage! {
    #[entrypoint]
    pub struct BinaryRouter {
        address amm_address;
        address usdc_token;
    }
}

pub enum Error {
    AmmCallFailed,
    UsdcTransferFailed,
}

impl From<Error> for Vec<u8> {
    fn from(e: Error) -> Self {
        match e {
            Error::AmmCallFailed => b"AmmCallFailed".to_vec(),
            Error::UsdcTransferFailed => b"UsdcTransferFailed".to_vec(),
        }
    }
}

#[public]
impl BinaryRouter {
    pub fn set_amm_address(&mut self, addr: Address) {
        self.amm_address.set(addr);
    }

    pub fn set_usdc_token(&mut self, token: Address) {
        self.usdc_token.set(token);
    }

    pub fn usdc_token(&self) -> Result<Address, Vec<u8>> {
        Ok(self.usdc_token.get())
    }

    pub fn get_binary_odds(&self, _target_price: I256) -> Result<I256, Vec<u8>> {
        // Return 50% odds
        Ok(I256::try_from(50i128).unwrap())
    }

    pub fn buy_yes(&mut self, target_price: I256) -> Result<(), Vec<u8>> {
        // Calculate the USDC cost: target_price is in WAD (18 decimals)
        // We scale it down to 6 decimals for USDC
        let cost_wad = target_price;
        let cost_usdc = U256::from_raw(cost_wad.into_raw()) / U256::from(1_000_000_000_000u64);

        let usdc = IERC20::new(self.usdc_token.get());
        let success = usdc.transfer_from(
            self,
            self.vm().msg_sender(),
            self.amm_address.get(),
            cost_usdc
        ).map_err(|_| Error::UsdcTransferFailed)?;

        if !success {
            return Err(Error::UsdcTransferFailed.into());
        }

        // Mock buy execution
        self.vm().log(TradeExecuted {
            user: self.vm().msg_sender(),
            target_price: to_u256(target_price),
            is_yes: true,
        });
        Ok(())
    }

    pub fn buy_no(&mut self, target_price: I256) -> Result<(), Vec<u8>> {
        // Calculate the USDC cost: target_price is in WAD (18 decimals)
        // We scale it down to 6 decimals for USDC
        let cost_wad = target_price;
        let cost_usdc = U256::from_raw(cost_wad.into_raw()) / U256::from(1_000_000_000_000u64);

        let usdc = IERC20::new(self.usdc_token.get());
        let success = usdc.transfer_from(
            self,
            self.vm().msg_sender(),
            self.amm_address.get(),
            cost_usdc
        ).map_err(|_| Error::UsdcTransferFailed)?;

        if !success {
            return Err(Error::UsdcTransferFailed.into());
        }

        // Mock buy execution
        self.vm().log(TradeExecuted {
            user: self.vm().msg_sender(),
            target_price: to_u256(target_price),
            is_yes: false,
        });
        Ok(())
    }
}

#[inline(always)]
fn to_u256(value: I256) -> U256 {
    value.into_raw()
}
