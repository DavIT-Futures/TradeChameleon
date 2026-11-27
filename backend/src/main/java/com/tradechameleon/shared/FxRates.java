package com.tradechameleon.shared;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Static, deterministic FX table used to value positions in the account currency.
 * A real platform would subscribe to a rates feed; for training purposes fixed rates keep tests stable.
 */
public final class FxRates {

    /** Value of one unit of the currency expressed in USD. */
    private static final Map<String, BigDecimal> USD_PER_UNIT = Map.of(
            "USD", new BigDecimal("1"),
            "EUR", new BigDecimal("1.0842"),
            "GBP", new BigDecimal("1.2715"),
            "PLN", new BigDecimal("0.2511"),
            "JPY", new BigDecimal("0.00667"),
            "CHF", new BigDecimal("1.1320"));

    private FxRates() {
    }

    /** Currencies the platform can value accounts in (and so the only ones a broker may use). */
    public static java.util.SortedSet<String> supported() {
        return new java.util.TreeSet<>(USD_PER_UNIT.keySet());
    }

    public static BigDecimal convert(BigDecimal amount, String from, String to) {
        if (from.equals(to)) {
            return amount;
        }
        BigDecimal usd = amount.multiply(rate(from));
        return usd.divide(rate(to), MathContext.DECIMAL64).setScale(4, RoundingMode.HALF_UP);
    }

    private static BigDecimal rate(String currency) {
        BigDecimal rate = USD_PER_UNIT.get(currency);
        if (rate == null) {
            throw new IllegalArgumentException("Unsupported currency " + currency);
        }
        return rate;
    }
}
