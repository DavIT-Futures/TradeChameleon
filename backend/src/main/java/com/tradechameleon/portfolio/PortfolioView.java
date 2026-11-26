package com.tradechameleon.portfolio;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.util.List;

/** Portfolio valued at current mid prices, converted to the account currency. */
public record PortfolioView(
        String currency,
        BigDecimal cash,
        BigDecimal positionsValue,
        BigDecimal totalValue,
        BigDecimal unrealizedPnl,
        BigDecimal unrealizedPnlPct,
        List<PositionView> positions) {

    /**
     * @param avgPrice    average cost in the instrument currency
     * @param lastPrice   current mid in the instrument currency
     * @param marketValue value in the account currency
     * @param pnl         unrealised profit/loss in the account currency
     */
    public record PositionView(
            String symbol,
            String name,
            AssetClass assetClass,
            String currency,
            BigDecimal quantity,
            BigDecimal avgPrice,
            BigDecimal lastPrice,
            BigDecimal marketValue,
            BigDecimal pnl,
            BigDecimal pnlPct) {
    }
}
