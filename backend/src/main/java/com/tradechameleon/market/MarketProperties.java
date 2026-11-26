package com.tradechameleon.market;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code tc.market.*}.
 *
 * @param seed         seed of the pseudo-random price paths; same seed, same prices
 * @param tickInterval how often the engine moves prices
 * @param historySize  how many ticks are kept per instrument (sparklines and charts)
 * @param autoStart    start ticking on startup (tests switch it off and tick manually)
 */
@ConfigurationProperties("tc.market")
public record MarketProperties(long seed, Duration tickInterval, int historySize, Boolean autoStart) {

    public MarketProperties {
        if (tickInterval == null) tickInterval = Duration.ofSeconds(1);
        if (historySize <= 0) historySize = 240;
        if (autoStart == null) autoStart = Boolean.TRUE;
    }
}
