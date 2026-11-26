package com.tradechameleon.shared;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Domain event published by the trading module when an order is executed.
 * The portfolio module listens to it and updates cash and positions.
 *
 * @param price    execution price in the instrument currency
 * @param currency the instrument currency (ISO 4217)
 */
public record OrderFilled(
        UUID orderId,
        String tenantId,
        String userId,
        String symbol,
        Side side,
        BigDecimal quantity,
        BigDecimal price,
        String currency,
        Instant filledAt) {

    /** quantity * price, in the instrument currency. */
    public BigDecimal notional() {
        return quantity.multiply(price);
    }
}
