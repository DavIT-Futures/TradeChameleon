package com.tradechameleon.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Simulated market depth around the tenant's quote: best levels first on both sides. */
public record OrderBook(String symbol, List<Level> bids, List<Level> asks, Instant timestamp) {

    public record Level(BigDecimal price, BigDecimal size) {
    }
}
