package com.tradechameleon.portfolio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A (partial) position close with its realised profit or loss.
 *
 * @param openPrice   average cost of the closed quantity, instrument currency
 * @param closePrice  sell price, instrument currency
 * @param realizedPnl (close − open) × quantity converted to the account currency
 */
public record ClosedTrade(
        UUID id,
        UUID orderId,
        String symbol,
        BigDecimal quantity,
        BigDecimal openPrice,
        BigDecimal closePrice,
        String currency,
        BigDecimal realizedPnl,
        Instant closedAt) {
}
