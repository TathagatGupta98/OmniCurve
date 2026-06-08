#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(not(any(test, feature = "export-abi")))]
#[no_mangle]
pub extern "C" fn main() {}

#[cfg(feature = "export-abi")]
fn main() {
    #[cfg(all(feature = "lp-token", not(any(feature = "factory", feature = "router", feature = "amm"))))]
    omnicurve_contracts::lp_token::print_from_args();

    #[cfg(feature = "factory")]
    omnicurve_contracts::factory::print_from_args();

    #[cfg(all(feature = "router", not(feature = "factory")))]
    omnicurve_contracts::binary_router::print_from_args();

    #[cfg(all(feature = "amm", not(any(feature = "router", feature = "factory"))))]
    omnicurve_contracts::distribution_amm::print_from_args();
}
