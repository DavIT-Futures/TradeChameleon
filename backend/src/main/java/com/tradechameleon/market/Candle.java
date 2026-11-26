package com.tradechameleon.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * OHLC candle aggregated from engine ticks.
 *
 * @param t     start of the interval
 * @param ticks number of price updates in the interval (a stand-in for volume in this simulator)
 */
public record Candle(Instant t, BigDecimal open, BigDecimal high, BigDecimal low, BigDecimal close, int ticks) {
}
