package com.tradechameleon.market;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Option chain of one underlying for one expiry: calls on the left, puts on the right of each strike.
 *
 * @param expiries     all available expiries; {@code expiry} is the one shown
 * @param rate         risk-free rate used for pricing
 * @param contractSize underlying units per option contract
 */
public record OptionChain(
        String underlying,
        String currency,
        BigDecimal spot,
        BigDecimal rate,
        int contractSize,
        List<LocalDate> expiries,
        LocalDate expiry,
        int daysToExpiry,
        List<Row> rows) {

    public record Row(BigDecimal strike, OptionQuote call, OptionQuote put) {
    }

    /**
     * @param iv    implied volatility in percent
     * @param theta per calendar day
     * @param vega  per volatility point
     */
    public record OptionQuote(
            BigDecimal bid,
            BigDecimal ask,
            BigDecimal mid,
            BigDecimal iv,
            BigDecimal delta,
            BigDecimal gamma,
            BigDecimal theta,
            BigDecimal vega,
            boolean inTheMoney) {
    }
}
