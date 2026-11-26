package com.tradechameleon.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A tenant-specific price: bid/ask include the broker's spread markup on top of the market spread.
 *
 * @param change    mid now minus the first mid of the session (opening price)
 * @param changePct change in percent of the opening price
 */
public record Quote(
        String symbol,
        BigDecimal bid,
        BigDecimal ask,
        BigDecimal mid,
        BigDecimal change,
        BigDecimal changePct,
        Instant timestamp) {
}
