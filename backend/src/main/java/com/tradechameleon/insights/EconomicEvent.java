package com.tradechameleon.insights;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * One macro-economic release in the calendar.
 *
 * @param importance 1 (low) … 3 (high, market-moving)
 * @param actual     published value; null until the release time has passed
 * @param surprise   ABOVE / BELOW / IN_LINE versus the forecast, null before release
 * @param symbols    instruments of the current broker that usually react to this release
 */
public record EconomicEvent(
        String id,
        Instant time,
        String country,
        String currency,
        String title,
        int importance,
        String unit,
        BigDecimal forecast,
        BigDecimal previous,
        BigDecimal actual,
        String surprise,
        List<String> symbols) {
}
