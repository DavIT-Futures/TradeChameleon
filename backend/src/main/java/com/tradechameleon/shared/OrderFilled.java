package com.tradechameleon.shared;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Domain event published by the trading module when an order is executed.
 * The portfolio module listens to it and updates cash, positions, the ledger and realised P&amp;L.
 *
 * @param price      execution price in the instrument currency
 * @param currency   the instrument currency (ISO 4217)
 * @param stopLoss   protection to attach to the resulting position (BUY only), may be null
 * @param takeProfit protection to attach to the resulting position (BUY only), may be null
 * @param reason     why the order exists: CLIENT, STOP_LOSS or TAKE_PROFIT
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
        Instant filledAt,
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        String reason) {

    /** quantity * price, in the instrument currency. */
    public BigDecimal notional() {
        return quantity.multiply(price);
    }
}
