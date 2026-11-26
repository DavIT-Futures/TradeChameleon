package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;

/** A tradable instrument. Prices are quoted in {@code currency} with {@code decimals} fraction digits. */
public record Instrument(
        String symbol,
        String name,
        AssetClass assetClass,
        String exchange,
        String currency,
        int decimals,
        BigDecimal basePrice) {
}
