extern crate alloc;

use alloy_primitives::{B256, I256, U256, Address};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;
use stylus_sdk::deploy::RawDeploy;
use alloc::vec;
use alloc::vec::Vec;

use crate::interfaces::{IProxyAmm, IProxyRouter};

sol! {
    event MarketCreated(uint256 indexed market_id, address amm, address router);
}

sol_storage! {
    #[entrypoint]
    pub struct OmniCurveFactory {
        address owner;
        address pending_owner;
        address amm_implementation;
        address router_implementation;
        uint256 market_count;
        mapping(uint256 => address) amm_proxies;
        mapping(uint256 => address) router_proxies;
    }
}

pub enum Error {
    Unauthorized,
    InitFailed,
    CloneFailed,
}

impl From<Error> for Vec<u8> {
    fn from(e: Error) -> Self {
        match e {
            Error::Unauthorized => b"Unauthorized".to_vec(),
            Error::InitFailed => b"InitFailed".to_vec(),
            Error::CloneFailed => b"CloneFailed".to_vec(),
        }
    }
}

/// Build the 55-byte EIP-1167 minimal proxy **creation code** for a given implementation address.
///
/// This is the full init code that CREATE2 executes. It consists of:
///
///   3d602d80600a3d3981f3  (10 bytes — init code: copies runtime to memory and returns it)
///   363d3d373d3d3d363d73  (10 bytes — runtime prefix: copy calldata, setup delegatecall)
///   <20-byte implementation address>
///   5af43d82803e903d91602b57fd5bf3  (15 bytes — runtime suffix: delegatecall, return/revert)
///
/// Total: 10 (init) + 45 (runtime) = 55 bytes.
/// Matches OpenZeppelin Clones.sol exactly.
fn build_eip1167_creation_code(implementation: Address) -> [u8; 55] {
    let mut code = [0u8; 55];

    // Init code: 3d602d80600a3d3981f3
    // RETURNDATASIZE(0) PUSH1(0x2d=45) DUP1 PUSH1(0x0a=10) RETURNDATASIZE(0) CODECOPY DUP2 RETURN
    code[0] = 0x3d;  // RETURNDATASIZE → 0 (memory offset)
    code[1] = 0x60;  // PUSH1
    code[2] = 0x2d;  //   0x2d = 45 (runtime code length)
    code[3] = 0x80;  // DUP1 (45)
    code[4] = 0x60;  // PUSH1
    code[5] = 0x0a;  //   0x0a = 10 (init code length, offset where runtime starts)
    code[6] = 0x3d;  // RETURNDATASIZE → 0 (memory dest)
    code[7] = 0x39;  // CODECOPY(destOffset=0, offset=10, length=45)
    code[8] = 0x81;  // DUP2 → 0 (return offset)
    code[9] = 0xf3;  // RETURN(offset=0, length=45)

    // Runtime code prefix: 363d3d373d3d3d363d73
    code[10] = 0x36;
    code[11] = 0x3d;
    code[12] = 0x3d;
    code[13] = 0x37;
    code[14] = 0x3d;
    code[15] = 0x3d;
    code[16] = 0x3d;
    code[17] = 0x36;
    code[18] = 0x3d;
    code[19] = 0x73;

    // Implementation address (20 bytes)
    let addr_bytes: [u8; 20] = implementation.into();
    code[20..40].copy_from_slice(&addr_bytes);

    // Runtime code suffix: 5af43d82803e903d91602b57fd5bf3
    code[40] = 0x5a;
    code[41] = 0xf4;
    code[42] = 0x3d;
    code[43] = 0x82;
    code[44] = 0x80;
    code[45] = 0x3e;
    code[46] = 0x90;
    code[47] = 0x3d;
    code[48] = 0x91;
    code[49] = 0x60;
    code[50] = 0x2b;
    code[51] = 0x57;
    code[52] = 0xfd;
    code[53] = 0x5b;
    code[54] = 0xf3;

    code
}


/// Compute a CREATE2 salt from a market_id and a domain tag (0 for AMM, 1 for Router).
fn market_salt(market_id: U256, domain: u8) -> B256 {
    let mut salt = [0u8; 32];
    let id_bytes: [u8; 32] = market_id.to_be_bytes();
    // Use first 31 bytes from market_id, last byte is the domain tag.
    salt[..31].copy_from_slice(&id_bytes[..31]);
    salt[31] = domain;
    B256::from(salt)
}

#[public]
impl OmniCurveFactory {
    /// One-time initialization. Sets the owner and the implementation addresses
    /// for the AMM and Router contracts that will be cloned for each new market.
    pub fn initialize(&mut self, owner: Address, amm_impl: Address, router_impl: Address) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO { return Err(b"Already initialized".to_vec()); }
        self.owner.set(owner);
        self.amm_implementation.set(amm_impl);
        self.router_implementation.set(router_impl);
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

    /// Allow the owner to update the AMM implementation address for future markets.
    pub fn set_amm_implementation(&mut self, impl_addr: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.amm_implementation.set(impl_addr);
        Ok(())
    }

    /// Allow the owner to update the Router implementation address for future markets.
    pub fn set_router_implementation(&mut self, impl_addr: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }
        self.router_implementation.set(impl_addr);
        Ok(())
    }

    /// Deploy a new market: creates EIP-1167 minimal proxy clones of the stored
    /// AMM and Router implementations, initializes them, wires them together,
    /// and transfers ownership to the caller.
    ///
    /// # Flow
    /// 1. Deploy AMM proxy clone via CREATE2
    /// 2. Deploy Router proxy clone via CREATE2
    /// 3. Initialize both proxies (factory becomes temporary owner)
    /// 4. Wire: amm.setRouterAddress(router), router.setAmmAddress(amm)
    /// 5. Set USDC token and sigma_min on both
    /// 6. Transfer ownership of both proxies to msg_sender
    ///
    /// # Note on ownership
    /// The factory calls `transferOwnership(caller)` on both proxies. The caller
    /// must then call `acceptOwnership()` on each proxy to finalize the two-step
    /// ownership transfer.
    pub fn create_market(
        &mut self,
        usdc: Address,
        sigma_min: I256,
    ) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() { return Err(Error::Unauthorized.into()); }

        let current_count = self.market_count.get();
        let factory_address = self.vm().contract_address();

        // --- Deploy AMM proxy clone ---
        let amm_bytecode = build_eip1167_creation_code(self.amm_implementation.get());
        let amm_salt = market_salt(current_count, 0);
        let amm_proxy = unsafe {
            RawDeploy::new()
                .salt(amm_salt)
                .deploy(self.vm(), &amm_bytecode, U256::ZERO)
                .map_err(|_| Error::CloneFailed)?
        };

        // --- Deploy Router proxy clone ---
        let router_bytecode = build_eip1167_creation_code(self.router_implementation.get());
        let router_salt = market_salt(current_count, 1);
        let router_proxy = unsafe {
            RawDeploy::new()
                .salt(router_salt)
                .deploy(self.vm(), &router_bytecode, U256::ZERO)
                .map_err(|_| Error::CloneFailed)?
        };

        // --- Initialize both proxies (factory is the initial owner) ---
        let proxy_amm = IProxyAmm::new(amm_proxy);
        let proxy_router = IProxyRouter::new(router_proxy);

        let cfg = Call::new_mutating(&mut *self);
        proxy_amm.initialize(self.vm(), cfg, factory_address).map_err(|_| Error::InitFailed)?;

        let cfg = Call::new_mutating(&mut *self);
        proxy_router.initialize(self.vm(), cfg, factory_address).map_err(|_| Error::InitFailed)?;

        // --- Wire AMM ---
        let cfg = Call::new_mutating(&mut *self);
        proxy_amm.set_router_address(self.vm(), cfg, router_proxy).map_err(|_| Error::InitFailed)?;

        let cfg = Call::new_mutating(&mut *self);
        proxy_amm.set_usdc_token(self.vm(), cfg, usdc).map_err(|_| Error::InitFailed)?;

        let cfg = Call::new_mutating(&mut *self);
        proxy_amm.set_sigma_min(self.vm(), cfg, sigma_min).map_err(|_| Error::InitFailed)?;

        // --- Wire Router ---
        let cfg = Call::new_mutating(&mut *self);
        proxy_router.set_amm_address(self.vm(), cfg, amm_proxy).map_err(|_| Error::InitFailed)?;

        let cfg = Call::new_mutating(&mut *self);
        proxy_router.set_usdc_token(self.vm(), cfg, usdc).map_err(|_| Error::InitFailed)?;

        // --- Transfer ownership to caller ---
        // NOTE: This is step 1 of a two-step transfer. The caller must call
        // acceptOwnership() on both the AMM and Router proxies to complete it.
        let creator = self.vm().msg_sender();

        let cfg = Call::new_mutating(&mut *self);
        proxy_amm.transfer_ownership(self.vm(), cfg, creator).map_err(|_| Error::InitFailed)?;

        let cfg = Call::new_mutating(&mut *self);
        proxy_router.transfer_ownership(self.vm(), cfg, creator).map_err(|_| Error::InitFailed)?;

        // --- Record market ---
        self.amm_proxies.setter(current_count).set(amm_proxy);
        self.router_proxies.setter(current_count).set(router_proxy);
        self.vm().log(MarketCreated { market_id: current_count, amm: amm_proxy, router: router_proxy });
        self.market_count.set(current_count + U256::from(1));

        Ok(())
    }

    pub fn get_market_amm(&self, market_id: U256) -> Result<Address, Vec<u8>> {
        Ok(self.amm_proxies.getter(market_id).get())
    }

    pub fn get_market_router(&self, market_id: U256) -> Result<Address, Vec<u8>> {
        Ok(self.router_proxies.getter(market_id).get())
    }

    pub fn get_market_count(&self) -> Result<U256, Vec<u8>> {
        Ok(self.market_count.get())
    }

    pub fn get_amm_implementation(&self) -> Result<Address, Vec<u8>> {
        Ok(self.amm_implementation.get())
    }

    pub fn get_router_implementation(&self) -> Result<Address, Vec<u8>> {
        Ok(self.router_implementation.get())
    }
}
