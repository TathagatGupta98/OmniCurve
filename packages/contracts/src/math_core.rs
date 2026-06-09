use alloy_primitives::{I256, U256};

const WAD_I128: i128 = 1_000_000_000_000_000_000;

#[inline(always)] fn wad() -> I256 { I256::try_from(WAD_I128).unwrap() }
#[cfg(test)]
#[inline(always)] fn half_wad() -> I256 { I256::try_from(500_000_000_000_000_000i128).unwrap() }
#[inline(always)] fn neg_half_wad() -> I256 { I256::try_from(-500_000_000_000_000_000i128).unwrap() }
#[inline(always)] fn sqrt_2_wad() -> I256 { I256::try_from(1_414_213_562_373_095_048i128).unwrap() }
#[inline(always)] fn sqrt_2pi_wad() -> I256 { I256::try_from(2_506_628_274_631_000_502i128).unwrap() }

#[inline(always)] fn erf_p_wad() -> I256 { I256::try_from(327_591_100_000_000_000i128).unwrap() }
#[inline(always)] fn erf_a1_wad() -> I256 { I256::try_from(254_829_592_000_000_000i128).unwrap() }
#[inline(always)] fn erf_a2_wad() -> I256 { I256::try_from(-284_496_736_000_000_000i128).unwrap() }
#[inline(always)] fn erf_a3_wad() -> I256 { I256::try_from(1_421_413_741_000_000_000i128).unwrap() }
#[inline(always)] fn erf_a4_wad() -> I256 { I256::try_from(-1_453_152_027_000_000_000i128).unwrap() }
#[inline(always)] fn erf_a5_wad() -> I256 { I256::try_from(1_061_405_429_000_000_000i128).unwrap() }

#[inline(always)] fn min_exp_wad() -> I256 { I256::try_from(-20_000_000_000_000_000_000i128).unwrap() }
const EXP_SERIES_TERMS: u32 = 18;

/// Compute the PDF of the normal distribution N(mu, sigma) at point x.
/// Returns a WAD-scaled value in [0, 1e18].
pub fn normal_pdf(x: I256, mu: I256, sigma: I256) -> I256 {
    if sigma <= I256::ZERO {
        return I256::ZERO;
    }

    let z = wad_div(x - mu, sigma);
    let z2 = wad_mul(z, z);
    let exponent = wad_mul(z2, neg_half_wad());
    let exp_val = exp_wad(exponent);

    let denom = wad_mul(sigma, sqrt_2pi_wad());
    if denom == I256::ZERO {
        return I256::ZERO;
    }

    let inv_denom = wad_div(wad(), denom);
    let pdf = wad_mul(inv_denom, exp_val);
    clamp_unit(pdf)
}

/// Compute the CDF of the normal distribution N(mu, sigma) at point x.
/// This computes Φ((x - μ) / σ) where Φ is the standard normal CDF.
/// Returns a WAD-scaled value in [0, 1e18].
pub fn normal_cdf(x: I256, mu: I256, sigma: I256) -> I256 {
    if sigma <= I256::ZERO {
        return I256::ZERO;
    }

    let z = wad_div(x - mu, sigma);
    let z = wad_div(z, sqrt_2_wad());
    let erf = erf_approx(z);
    let cdf = (wad() + erf) / I256::try_from(2i128).unwrap();
    clamp_unit(cdf)
}

fn erf_approx(x: I256) -> I256 {
    if x == I256::ZERO {
        return I256::ZERO;
    }

    let sign_negative = x < I256::ZERO;
    let x = abs_i256(x);

    let t = wad_div(wad(), wad() + wad_mul(erf_p_wad(), x));
    let t2 = wad_mul(t, t);
    let t3 = wad_mul(t2, t);
    let t4 = wad_mul(t3, t);
    let t5 = wad_mul(t4, t);

    let poly = wad_mul(erf_a1_wad(), t)
        + wad_mul(erf_a2_wad(), t2)
        + wad_mul(erf_a3_wad(), t3)
        + wad_mul(erf_a4_wad(), t4)
        + wad_mul(erf_a5_wad(), t5);

    let exp_term = exp_wad(-wad_mul(x, x));
    let mut erf = wad() - wad_mul(poly, exp_term);
    erf = clamp_unit(erf);

    if sign_negative {
        -erf
    } else {
        erf
    }
}

fn exp_wad(x: I256) -> I256 {
    // Guard: exp(20) ≈ 4.85e8 which fits; exp(>20 WAD) overflows I256
    let max_exp_wad = I256::try_from(20_000_000_000_000_000_000i128).unwrap();
    if x >= max_exp_wad {
        // Return a saturated large value (1e18 * 1e8 = 1e26, safely below I256 max)
        return I256::try_from(100_000_000_000_000_000_000_000_000i128)
            .unwrap_or(I256::MAX);
    }
    if x <= min_exp_wad() {
        return I256::ZERO;
    }

    let mut term = wad();
    let mut sum = wad();

    for n in 1..=EXP_SERIES_TERMS {
        term = wad_mul(term, x);
        term = term / I256::try_from(n as i128).unwrap();
        sum += term;
    }

    if sum < I256::ZERO {
        I256::ZERO
    } else {
        sum
    }
}

pub fn wad_mul(a: I256, b: I256) -> I256 {
    (a * b) / wad()
}

pub fn wad_div(a: I256, b: I256) -> I256 {
    if b == I256::ZERO {
        return I256::ZERO;
    }
    (a * wad()) / b
}

pub fn abs_i256(x: I256) -> I256 {
    if x < I256::ZERO {
        -x
    } else {
        x
    }
}

fn clamp_unit(x: I256) -> I256 {
    if x < I256::ZERO {
        I256::ZERO
    } else if x > wad() {
        wad()
    } else {
        x
    }
}

/// Safely convert I256 to U256. Panics if the value is negative.
/// Use this instead of U256::from(value.into_raw()) to avoid
/// two's-complement reinterpretation of negative values.
pub fn safe_to_u256(value: I256) -> U256 {
    assert!(value >= I256::ZERO, "Cannot convert negative I256 to U256");
    U256::from(value.into_raw())
}

/// Integer square root in WAD precision using Newton's method.
/// Input x is WAD-scaled (i.e. represents x / 1e18).
/// Returns sqrt(x) also in WAD precision.
///
/// To maintain WAD precision: sqrt_wad(x_wad) = sqrt(x_wad * WAD)
/// because if x_wad = val * 1e18, then sqrt(val) * 1e18 = sqrt(val * 1e18 * 1e18) = sqrt(x_wad * 1e18)
pub fn sqrt_wad(x: I256) -> I256 {
    if x <= I256::ZERO {
        return I256::ZERO;
    }

    // We compute sqrt(x * WAD) to maintain WAD precision
    let scaled = x * wad();

    // Newton's method: start with initial guess
    let mut guess = scaled;
    // Better initial guess: start with x itself (or scaled / 2 + 1)
    // For large numbers, starting with scaled can be expensive; use x as starting point
    if x > wad() {
        guess = x;
    }

    // Newton iterations: guess = (guess + scaled / guess) / 2
    let two = I256::try_from(2i128).unwrap();
    for _ in 0..128 {
        let new_guess = (guess + scaled / guess) / two;
        if new_guess >= guess {
            break;
        }
        guess = new_guess;
    }

    guess
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wad_value(value: i128) -> I256 {
        I256::try_from(value).unwrap()
    }

    #[test]
    fn test_wad_arithmetic_helpers() {
        assert_eq!(wad_mul(wad_value(2_000_000_000_000_000_000), wad_value(3_000_000_000_000_000_000)), wad_value(6_000_000_000_000_000_000));
        assert_eq!(wad_mul(wad_value(-2_000_000_000_000_000_000), wad_value(3_000_000_000_000_000_000)), wad_value(-6_000_000_000_000_000_000));
        assert_eq!(wad_div(wad_value(6_000_000_000_000_000_000), wad_value(3_000_000_000_000_000_000)), wad_value(2_000_000_000_000_000_000));
        assert_eq!(wad_div(wad_value(1_000_000_000_000_000_000), I256::ZERO), I256::ZERO);
        assert_eq!(abs_i256(wad_value(-123_000_000_000_000_000)), wad_value(123_000_000_000_000_000));
        assert_eq!(abs_i256(wad_value(123_000_000_000_000_000)), wad_value(123_000_000_000_000_000));
    }

    #[test]
    fn test_exp_and_invalid_sigma() {
        assert_eq!(exp_wad(I256::ZERO), wad());

        assert_eq!(normal_pdf(I256::ZERO, I256::ZERO, I256::ZERO), I256::ZERO);
        assert_eq!(normal_cdf(I256::ZERO, I256::ZERO, I256::ZERO), I256::ZERO);
    }

    #[test]
    fn test_standard_normal_distribution() {
        let mu = I256::ZERO;
        let sigma = wad();

        // For a standard normal distribution, the PDF at x=0 is 1/sqrt(2pi) ≈ 0.398942
        let pdf_at_zero = normal_pdf(I256::ZERO, mu, sigma);
        let expected_pdf = I256::try_from(398_942_000_000_000_000i128).unwrap();
        let margin = I256::try_from(1_000_000_000_000_000i128).unwrap(); // 0.001
        
        let diff = abs_i256(pdf_at_zero - expected_pdf);
        assert!(diff < margin, "PDF at 0 is far from expected: {}", pdf_at_zero);

        // The CDF at x=0 should be exactly 0.5 (half_wad)
        let cdf_at_zero = normal_cdf(I256::ZERO, mu, sigma);
        let expected_cdf = half_wad();
        let diff_cdf = abs_i256(cdf_at_zero - expected_cdf);
        assert!(diff_cdf < margin, "CDF at 0 is far from expected: {}", cdf_at_zero);
    }

    #[test]
    fn test_pdf_symmetry_and_peak() {
        let mu = wad();
        let sigma = half_wad();
        let delta = wad_value(250_000_000_000_000_000);

        let left = normal_pdf(mu - delta, mu, sigma);
        let right = normal_pdf(mu + delta, mu, sigma);
        let symmetry_margin = wad_value(1_000_000_000_000_000);

        assert!(abs_i256(left - right) < symmetry_margin, "PDF should be symmetric around mu");
        assert!(normal_pdf(mu, mu, sigma) > left, "PDF should peak at mu");
    }

    #[test]
    fn test_cdf_monotonicity_and_complement() {
        let mu = wad();
        let sigma = half_wad();
        let lower = normal_cdf(mu - wad_value(250_000_000_000_000_000), mu, sigma);
        let center = normal_cdf(mu, mu, sigma);
        let upper = normal_cdf(mu + wad_value(250_000_000_000_000_000), mu, sigma);

        assert!(lower < center, "CDF should increase as x approaches mu");
        assert!(center < upper, "CDF should increase as x moves above mu");

        let complement_margin = wad_value(2_000_000_000_000_000);
        let symmetric_lower = normal_cdf(mu - wad_value(500_000_000_000_000_000), mu, sigma);
        let symmetric_upper = normal_cdf(mu + wad_value(500_000_000_000_000_000), mu, sigma);
        assert!(abs_i256((wad() - symmetric_lower) - symmetric_upper) < complement_margin, "CDF should be close to complementary around mu");
    }

    #[test]
    fn test_cdf_extremes() {
        let mu = wad();
        let sigma = half_wad();

        // Very low target price (-10 sigma)
        let low_x = mu - wad_mul(wad_value(10_000_000_000_000_000_000), sigma);
        let cdf_low = normal_cdf(low_x, mu, sigma);
        let margin = wad_value(1_000_000_000_000_000); // 0.001
        assert!(cdf_low < margin, "CDF for very low x should approach 0");

        // Very high target price (+10 sigma)
        let high_x = mu + wad_mul(wad_value(10_000_000_000_000_000_000), sigma);
        let cdf_high = normal_cdf(high_x, mu, sigma);
        let diff_high = abs_i256(wad() - cdf_high);
        assert!(diff_high < margin, "CDF for very high x should approach 1, got {}", cdf_high);
    }

    #[test]
    fn test_smaller_sigma_higher_peak() {
        let mu = I256::ZERO;
        let sigma1 = wad(); // 1.0
        let sigma2 = half_wad(); // 0.5
        
        let peak1 = normal_pdf(mu, mu, sigma1);
        let peak2 = normal_pdf(mu, mu, sigma2);

        assert!(peak2 > peak1, "A smaller sigma should result in a higher peak PDF");
    }

    #[test]
    fn test_safe_to_u256() {
        let positive = I256::try_from(42_000_000_000_000_000_000i128).unwrap();
        let result = safe_to_u256(positive);
        assert_eq!(result, U256::from(42_000_000_000_000_000_000u128));

        let zero = I256::ZERO;
        assert_eq!(safe_to_u256(zero), U256::ZERO);
    }

    #[test]
    #[should_panic(expected = "Cannot convert negative I256 to U256")]
    fn test_safe_to_u256_negative_panics() {
        let negative = I256::try_from(-1i128).unwrap();
        safe_to_u256(negative);
    }

    #[test]
    fn test_sqrt_wad() {
        // sqrt(1.0) = 1.0
        let one = wad();
        let result = sqrt_wad(one);
        let margin = wad_value(1_000_000_000_000_000); // 0.001
        assert!(abs_i256(result - one) < margin, "sqrt(1) should be 1, got {}", result);

        // sqrt(4.0) = 2.0
        let four = I256::try_from(4_000_000_000_000_000_000i128).unwrap();
        let expected = I256::try_from(2_000_000_000_000_000_000i128).unwrap();
        let result = sqrt_wad(four);
        assert!(abs_i256(result - expected) < margin, "sqrt(4) should be 2, got {}", result);

        // sqrt(0) = 0
        assert_eq!(sqrt_wad(I256::ZERO), I256::ZERO);
    }
}
