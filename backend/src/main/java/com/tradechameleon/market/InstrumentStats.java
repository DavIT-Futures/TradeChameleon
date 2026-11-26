package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;

/**
 * Technical snapshot of one instrument, used by the screener and the sentiment widget.
 *
 * @param volatilityPct 1-hour realised volatility in percent (from 1-second tick returns)
 * @param rsi14         RSI(14) on 1-minute candles, null while there is not enough history
 * @param high          highest price in the engine's history window (2 h)
 * @param low           lowest price in the same window
 * @param rangePct      where the current price sits in [low, high], 0 = at the low, 100 = at the high
 * @param longPct       simulated share of the broker's clients holding long positions
 */
public record InstrumentStats(
        String symbol,
        String name,
        AssetClass assetClass,
        String category,
        int decimals,
        BigDecimal mid,
        BigDecimal changePct,
        BigDecimal volatilityPct,
        BigDecimal rsi14,
        BigDecimal high,
        BigDecimal low,
        BigDecimal rangePct,
        BigDecimal spreadBps,
        int longPct) {
}
