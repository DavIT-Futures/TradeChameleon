package com.tradechameleon.insights;

import com.tradechameleon.shared.AssetClass;
import java.time.Instant;

/** A (simulated) market headline about one instrument. */
public record NewsItem(
        String id,
        Instant time,
        String symbol,
        AssetClass assetClass,
        String headline,
        String summary,
        Sentiment sentiment,
        String source) {

    public enum Sentiment { POSITIVE, NEUTRAL, NEGATIVE }
}
