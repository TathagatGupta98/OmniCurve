use alloy_primitives::I256;

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

pub fn gaussian_pdf(x: I256, mu: I256, sigma: I256) -> I256 {
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

pub fn gaussian_cdf(x: I256, mu: I256, sigma: I256) -> I256 {
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

        assert_eq!(gaussian_pdf(I256::ZERO, I256::ZERO, I256::ZERO), I256::ZERO);
        assert_eq!(gaussian_cdf(I256::ZERO, I256::ZERO, I256::ZERO), I256::ZERO);
    }

    #[test]
    fn test_standard_normal_distribution() {
        let mu = I256::ZERO;
        let sigma = wad();

        // For a standard normal distribution, the PDF at x=0 is 1/sqrt(2pi) ≈ 0.398942
        let pdf_at_zero = gaussian_pdf(I256::ZERO, mu, sigma);
        let expected_pdf = I256::try_from(398_942_000_000_000_000i128).unwrap();
        let margin = I256::try_from(1_000_000_000_000_000i128).unwrap(); // 0.001
        
        let diff = abs_i256(pdf_at_zero - expected_pdf);
        assert!(diff < margin, "PDF at 0 is far from expected: {}", pdf_at_zero);

        // The CDF at x=0 should be exactly 0.5 (half_wad)
        let cdf_at_zero = gaussian_cdf(I256::ZERO, mu, sigma);
        let expected_cdf = half_wad();
        let diff_cdf = abs_i256(cdf_at_zero - expected_cdf);
        assert!(diff_cdf < margin, "CDF at 0 is far from expected: {}", cdf_at_zero);
    }

    #[test]
    fn test_pdf_symmetry_and_peak() {
        let mu = wad();
        let sigma = half_wad();
        let delta = wad_value(250_000_000_000_000_000);

        let left = gaussian_pdf(mu - delta, mu, sigma);
        let right = gaussian_pdf(mu + delta, mu, sigma);
        let symmetry_margin = wad_value(1_000_000_000_000_000);

        assert!(abs_i256(left - right) < symmetry_margin, "PDF should be symmetric around mu");
        assert!(gaussian_pdf(mu, mu, sigma) > left, "PDF should peak at mu");
    }

    #[test]
    fn test_cdf_monotonicity_and_complement() {
        let mu = wad();
        let sigma = half_wad();
        let lower = gaussian_cdf(mu - wad_value(250_000_000_000_000_000), mu, sigma);
        let center = gaussian_cdf(mu, mu, sigma);
        let upper = gaussian_cdf(mu + wad_value(250_000_000_000_000_000), mu, sigma);

        assert!(lower < center, "CDF should increase as x approaches mu");
        assert!(center < upper, "CDF should increase as x moves above mu");

        let complement_margin = wad_value(2_000_000_000_000_000);
        let symmetric_lower = gaussian_cdf(mu - wad_value(500_000_000_000_000_000), mu, sigma);
        let symmetric_upper = gaussian_cdf(mu + wad_value(500_000_000_000_000_000), mu, sigma);
        assert!(abs_i256((wad() - symmetric_lower) - symmetric_upper) < complement_margin, "CDF should be close to complementary around mu");
    }

    #[test]
    fn test_cdf_extremes() {
        let mu = wad();
        let sigma = half_wad();

        // Very low target price (-10 sigma)
        let low_x = mu - wad_mul(wad_value(10_000_000_000_000_000_000), sigma);
        let cdf_low = gaussian_cdf(low_x, mu, sigma);
        let margin = wad_value(1_000_000_000_000_000); // 0.001
        assert!(cdf_low < margin, "CDF for very low x should approach 0");

        // Very high target price (+10 sigma)
        let high_x = mu + wad_mul(wad_value(10_000_000_000_000_000_000), sigma);
        let cdf_high = gaussian_cdf(high_x, mu, sigma);
        let diff_high = abs_i256(wad() - cdf_high);
        assert!(diff_high < margin, "CDF for very high x should approach 1, got {}", cdf_high);
    }

    #[test]
    fn test_smaller_sigma_higher_peak() {
        let mu = I256::ZERO;
        let sigma1 = wad(); // 1.0
        let sigma2 = half_wad(); // 0.5
        
        let peak1 = gaussian_pdf(mu, mu, sigma1);
        let peak2 = gaussian_pdf(mu, mu, sigma2);

        assert!(peak2 > peak1, "A smaller sigma should result in a higher peak PDF");
    }
}
