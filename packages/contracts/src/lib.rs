#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![allow(unexpected_cfgs)]

extern crate alloc;

pub mod math_core;
pub mod interfaces;

#[cfg(any(feature = "amm", not(any(feature = "router", feature = "factory", feature = "lp-token"))))]
pub mod distribution_amm;

#[cfg(all(feature = "router", not(any(feature = "factory", feature = "lp-token"))))]
pub mod binary_router;

#[cfg(all(feature = "lp-token", not(feature = "factory")))]
pub mod lp_token;

#[cfg(feature = "factory")]
pub mod factory;
