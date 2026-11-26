package com.tradechameleon.trading;

import com.tradechameleon.shared.Side;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** An order as stored and as returned by the API. */
public record Order(
        UUID id,
        String tenantId,
        String userId,
        String symbol,
        Side side,
        OrderType type,
        BigDecimal quantity,
        BigDecimal limitPrice,
        OrderStatus status,
        BigDecimal fillPrice,
        String rejectReason,
        Instant createdAt,
        Instant updatedAt) {

    public enum OrderType { MARKET, LIMIT }

    public enum OrderStatus { OPEN, FILLED, CANCELLED, REJECTED }

    Order filled(BigDecimal price, Instant at) {
        return new Order(id, tenantId, userId, symbol, side, type, quantity, limitPrice, OrderStatus.FILLED, price,
                null, createdAt, at);
    }
}
