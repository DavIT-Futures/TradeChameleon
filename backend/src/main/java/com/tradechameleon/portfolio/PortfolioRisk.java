package com.tradechameleon.portfolio;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.util.List;

/**
 * Risk view of the portfolio as if every position were held as a CFD under the broker's margin rules.
 * All amounts are in the account currency.
 *
 * @param equity         cash + market value of positions
 * @param exposure       market value of all positions
 * @param marginRequired sum of exposure × margin rate
 * @param freeMargin     equity − margin required
 * @param marginLevelPct equity / margin required × 100 (null without positions); below 50% a broker would close out
 * @param leverage       exposure / equity
 * @param warnings       human-readable risk flags (concentration, low margin level…)
 */
public record PortfolioRisk(
        String currency,
        BigDecimal equity,
        BigDecimal exposure,
        BigDecimal marginRequired,
        BigDecimal freeMargin,
        BigDecimal marginLevelPct,
        BigDecimal leverage,
        List<ClassRisk> byClass,
        List<PositionRisk> positions,
        List<String> warnings) {

    public record ClassRisk(AssetClass assetClass, BigDecimal exposure, BigDecimal sharePct, BigDecimal margin) {
    }

    public record PositionRisk(String symbol, AssetClass assetClass, BigDecimal exposure, BigDecimal sharePct,
                               BigDecimal marginRate, int leverage, BigDecimal margin) {
    }
}
