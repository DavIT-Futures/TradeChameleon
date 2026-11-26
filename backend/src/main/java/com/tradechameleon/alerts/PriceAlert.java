package com.tradechameleon.alerts;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * "Tell me when SAP goes above 240." Evaluated against the mid price on every tick.
 *
 * @param acknowledged the client has shown the notification for a triggered alert
 */
public record PriceAlert(
        UUID id,
        String symbol,
        Condition condition,
        BigDecimal price,
        String note,
        Status status,
        boolean acknowledged,
        Instant createdAt,
        Instant triggeredAt,
        BigDecimal triggeredPrice) {

    public enum Condition { ABOVE, BELOW }

    public enum Status { ACTIVE, TRIGGERED, CANCELLED }

    /** True when {@code mid} satisfies the condition. */
    public boolean isMetBy(BigDecimal mid) {
        return condition == Condition.ABOVE ? mid.compareTo(price) >= 0 : mid.compareTo(price) <= 0;
    }
}
