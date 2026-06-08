extern crate alloc;

use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;
use alloy_primitives::{Address, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol! {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

sol_storage! {
    #[entrypoint]
    pub struct LpToken {
        address owner;
        address pending_owner;
        string name;
        string symbol;
        uint256 total_supply;
        mapping(address => uint256) balances;
        mapping(address => mapping(address => uint256)) allowances;
    }
}

pub enum Error {
    Unauthorized,
    InsufficientBalance,
    InsufficientAllowance,
    Overflow,
}

impl From<Error> for Vec<u8> {
    fn from(err: Error) -> Vec<u8> {
        match err {
            Error::Unauthorized => b"Unauthorized".to_vec(),
            Error::InsufficientBalance => b"InsufficientBalance".to_vec(),
            Error::InsufficientAllowance => b"InsufficientAllowance".to_vec(),
            Error::Overflow => b"Overflow".to_vec(),
        }
    }
}

#[public]
impl LpToken {
    pub fn initialize(&mut self, owner: Address, name: String, symbol: String) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err(Error::Unauthorized.into());
        }
        self.owner.set(owner);
        self.name.set_str(&name);
        self.symbol.set_str(&symbol);
        Ok(())
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), Vec<u8>> {
        if self.owner.get() != self.vm().msg_sender() {
            return Err(Error::Unauthorized.into());
        }
        self.pending_owner.set(new_owner);
        Ok(())
    }

    pub fn accept_ownership(&mut self) -> Result<(), Vec<u8>> {
        if self.pending_owner.get() != self.vm().msg_sender() {
            return Err(Error::Unauthorized.into());
        }
        self.owner.set(self.pending_owner.get());
        self.pending_owner.set(Address::ZERO);
        Ok(())
    }

    pub fn name(&self) -> Result<String, Vec<u8>> {
        Ok(self.name.get_string())
    }

    pub fn symbol(&self) -> Result<String, Vec<u8>> {
        Ok(self.symbol.get_string())
    }

    pub fn decimals(&self) -> Result<u8, Vec<u8>> {
        Ok(18)
    }

    pub fn total_supply(&self) -> Result<U256, Vec<u8>> {
        Ok(self.total_supply.get())
    }

    pub fn balance_of(&self, account: Address) -> Result<U256, Vec<u8>> {
        Ok(self.balances.getter(account).get())
    }

    pub fn allowance(&self, owner: Address, spender: Address) -> Result<U256, Vec<u8>> {
        Ok(self.allowances.getter(owner).getter(spender).get())
    }

    pub fn transfer(&mut self, _to: Address, _amount: U256) -> Result<bool, Vec<u8>> {
        Err(Error::Unauthorized.into())
    }

    pub fn approve(&mut self, spender: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let owner = self.vm().msg_sender();
        self.allowances.setter(owner).setter(spender).set(amount);
        self.vm().log(Approval { owner, spender, value: amount });
        Ok(true)
    }

    pub fn transfer_from(&mut self, _from: Address, _to: Address, _amount: U256) -> Result<bool, Vec<u8>> {
        Err(Error::Unauthorized.into())
    }

    pub fn mint(&mut self, to: Address, amount: U256) -> Result<(), Vec<u8>> {
        if self.owner.get() != self.vm().msg_sender() {
            return Err(Error::Unauthorized.into());
        }
        let current_supply = self.total_supply.get();
        let new_supply = current_supply.checked_add(amount).ok_or(Error::Overflow)?;
        self.total_supply.set(new_supply);

        let mut balance_slot = self.balances.setter(to);
        let new_balance = balance_slot.get().checked_add(amount).ok_or(Error::Overflow)?;
        balance_slot.set(new_balance);

        self.vm().log(Transfer { from: Address::ZERO, to, value: amount });
        Ok(())
    }

    pub fn burn(&mut self, from: Address, amount: U256) -> Result<(), Vec<u8>> {
        if self.owner.get() != self.vm().msg_sender() {
            return Err(Error::Unauthorized.into());
        }
        let current_supply = self.total_supply.get();
        if current_supply < amount {
            return Err(Error::InsufficientBalance.into());
        }
        self.total_supply.set(current_supply - amount);

        let mut balance_slot = self.balances.setter(from);
        let current_balance = balance_slot.get();
        if current_balance < amount {
            return Err(Error::InsufficientBalance.into());
        }
        balance_slot.set(current_balance - amount);

        self.vm().log(Transfer { from, to: Address::ZERO, value: amount });
        Ok(())
    }
}


