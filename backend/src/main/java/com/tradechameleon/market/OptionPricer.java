package com.tradechameleon.market;

/**
 * Black-Scholes pricing for European options on a non-dividend-paying underlying.
 * Pure maths, no Spring: easy to unit-test (e.g. put-call parity).
 *
 * <pre>
 * d1 = (ln(S/K) + (r + σ²/2)·T) / (σ·√T)     d2 = d1 − σ·√T
 * call = S·N(d1) − K·e^(−rT)·N(d2)            put = K·e^(−rT)·N(−d2) − S·N(−d1)
 * </pre>
 */
final class OptionPricer {

    private OptionPricer() {
    }

    /**
     * @param price option premium per unit of the underlying
     * @param delta ∂price/∂S
     * @param gamma ∂²price/∂S²
     * @param theta price change per calendar day
     * @param vega  price change per 1 volatility point (0.01)
     */
    record Greeks(double price, double delta, double gamma, double theta, double vega) {
    }

    /**
     * @param s     spot price
     * @param k     strike
     * @param t     time to expiry in years
     * @param r     risk-free rate (0.03 = 3%)
     * @param sigma implied volatility (0.25 = 25%)
     */
    static Greeks call(double s, double k, double t, double r, double sigma) {
        double sqrtT = Math.sqrt(t);
        double d1 = (Math.log(s / k) + (r + sigma * sigma / 2) * t) / (sigma * sqrtT);
        double d2 = d1 - sigma * sqrtT;
        double discount = Math.exp(-r * t);
        double price = s * cdf(d1) - k * discount * cdf(d2);
        double theta = (-s * pdf(d1) * sigma / (2 * sqrtT) - r * k * discount * cdf(d2)) / 365;
        return new Greeks(price, cdf(d1), gamma(s, d1, sigma, sqrtT), theta, vega(s, d1, sqrtT));
    }

    static Greeks put(double s, double k, double t, double r, double sigma) {
        double sqrtT = Math.sqrt(t);
        double d1 = (Math.log(s / k) + (r + sigma * sigma / 2) * t) / (sigma * sqrtT);
        double d2 = d1 - sigma * sqrtT;
        double discount = Math.exp(-r * t);
        double price = k * discount * cdf(-d2) - s * cdf(-d1);
        double theta = (-s * pdf(d1) * sigma / (2 * sqrtT) + r * k * discount * cdf(-d2)) / 365;
        return new Greeks(price, cdf(d1) - 1, gamma(s, d1, sigma, sqrtT), theta, vega(s, d1, sqrtT));
    }

    private static double gamma(double s, double d1, double sigma, double sqrtT) {
        return pdf(d1) / (s * sigma * sqrtT);
    }

    private static double vega(double s, double d1, double sqrtT) {
        return s * pdf(d1) * sqrtT / 100;
    }

    static double pdf(double x) {
        return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    }

    /** Standard normal CDF, Abramowitz &amp; Stegun 26.2.17 (absolute error &lt; 7.5e-8). */
    static double cdf(double x) {
        if (x < 0) {
            return 1 - cdf(-x);
        }
        double t = 1 / (1 + 0.2316419 * x);
        double poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
        return 1 - pdf(x) * poly;
    }
}
