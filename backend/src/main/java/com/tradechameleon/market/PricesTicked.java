package com.tradechameleon.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Published by the price engine after every tick. A plain in-memory event (no persistence):
 * it is high-frequency and losing one is harmless because the next tick follows a second later.
 */
public record PricesTicked(Instant at, List<Tick> ticks) {

    public record Tick(String symbol, BigDecimal mid) {
    }
}
