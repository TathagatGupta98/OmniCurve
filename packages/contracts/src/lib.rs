#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![allow(unexpected_cfgs)]

extern crate alloc;

pub mod math_core;
pub mod interfaces;

#[cfg(any(feature = "amm", not(any(feature = "router", feature = "factory"))))]
pub mod distribution_amm;

#[cfg(any(feature = "router", not(any(feature = "amm", feature = "factory"))))]
pub mod binary_router;

#[cfg(feature = "factory")]
pub mod factory;
