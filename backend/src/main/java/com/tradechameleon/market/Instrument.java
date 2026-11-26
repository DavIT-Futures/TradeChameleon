package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;

/**
 * A tradable instrument. Prices are quoted in {@code currency} with {@code decimals} fraction digits.
 *
 * @param category     sub-category used for browsing (e.g. Technology, Majors, Energy, Europe)
 * @param unit         what one price unit refers to (share, troy oz, barrel, index point, base unit...)
 * @param contractSize units per contract or lot (100,000 for an FX lot, 100 oz for gold...)
 * @param pipSize      FX only: the conventional smallest price step (0.0001, or 0.01 for JPY pairs)
 * @param optionable   an option chain is available on this underlying
 */
public record Instrument(
        String symbol,
        String name,
        AssetClass assetClass,
        String exchange,
        String currency,
        int decimals,
        BigDecimal basePrice,
        String category,
        String unit,
        BigDecimal contractSize,
        BigDecimal pipSize,
        boolean optionable,
        String description) {

    /** Convenience constructor for tests and simple instruments. */
    public Instrument(String symbol, String name, AssetClass assetClass, String exchange, String currency, int decimals,
                      BigDecimal basePrice) {
        this(symbol, name, assetClass, exchange, currency, decimals, basePrice, "Other", "unit", BigDecimal.ONE, null,
                false, "");
    }
}
