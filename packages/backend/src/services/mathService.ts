// @ts-ignore
import { jStat } from 'jstat';

/**
 * Calculates the expected probabilities/prices for YES and NO tokens based on the
 * continuous distribution AMM model (Gaussian).
 * 
 * @param x The target price strike
 * @param mu The current peak/mean of the distribution
 * @param sigma The current standard deviation
 */
export const calculateExpectedPrices = (x: number, mu: number, sigma: number) => {
  const safeSigma = Math.max(sigma, 0.000001); // Prevent division by zero
  
  // CDF gives the area under the curve up to X
  const cdf = jStat.normal.cdf(x, mu, safeSigma);
  
  // According to OmniCurve math:
  // P_NO = CDF(X)
  // P_YES = 1 - CDF(X)
  return {
    pYes: 1 - cdf,
    pNo: cdf,
  };
};
