use alloy_primitives::I256;

const WAD_I128: i128 = 1_000_000_000_000_000_000;

#[inline(always)] fn wad() -> I256 { I256::try_from(WAD_I128).unwrap() }
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
