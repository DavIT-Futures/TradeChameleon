package com.tradechameleon.alerts;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Published when a price alert fires; a hook for e-mail/push notifications in a real system. */
public record AlertTriggered(UUID alertId, String tenantId, String userId, String symbol, BigDecimal price,
                             Instant at) {
}
