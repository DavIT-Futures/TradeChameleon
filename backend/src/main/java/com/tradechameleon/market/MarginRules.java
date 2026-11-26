package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.util.Set;

/**
 * Initial margin rates for trading an instrument as a CFD, modelled on the ESMA retail limits:
 * major FX pairs 1:30, other FX, indices and gold 1:20, other commodities 1:10, stocks and ETFs 1:5,
 * crypto 1:2. Bonds 1:10. Public API of the market module (the portfolio uses it for the risk view).
 */
public final class MarginRules {

    private static final Set<String> MAJOR_FX = Set.of("EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "EURGBP");

    private MarginRules() {
    }

    /** Fraction of the exposure that must be covered by equity, e.g. 0.0333 for 1:30. */
    public static BigDecimal marginRate(Instrument i) {
        return switch (i.assetClass()) {
            case FX -> MAJOR_FX.contains(i.symbol()) ? new BigDecimal("0.0333") : new BigDecimal("0.05");
            case INDEX -> new BigDecimal("0.05");
            case COMMODITY -> "XAUUSD".equals(i.symbol()) ? new BigDecimal("0.05") : new BigDecimal("0.10");
            case STOCK, ETF -> new BigDecimal("0.20");
            case CRYPTO -> new BigDecimal("0.50");
            case BOND -> new BigDecimal("0.10");
            case OPTION -> BigDecimal.ONE;
        };
    }

    /** Maximum leverage implied by the margin rate, e.g. 30 for 1:30. */
    public static int leverage(Instrument i) {
        return (int) Math.round(1 / marginRate(i).doubleValue());
    }
}
