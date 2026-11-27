package com.tradechameleon.tenant;

import com.tradechameleon.shared.AssetClass;
import java.util.Set;

/**
 * A white-label broker. Everything that differs between brands lives here: branding, locale,
 * currency, the asset classes clients may trade, the spread markup and feature flags.
 */
public record Tenant(
        String id,
        String name,
        String tagline,
        String locale,
        String currency,
        Set<AssetClass> allowedAssetClasses,
        int spreadMarkupBps,
        String logoShape,
        Theme theme,
        Features features,
        Limits limits) {

    /** Visual identity, rendered by the clients as CSS custom properties. */
    public record Theme(
            String primary,
            String onPrimary,
            String accent,
            String background,
            String surface,
            String text,
            String muted,
            String positive,
            String negative,
            String radius,
            String colorScheme,
            String fontBody,
            String fontHeading) {
    }

    /**
     * Feature flags. A broker with {@code trading=false} is a portfolio-only (read-only) brand;
     * {@code limitOrders=false} means market orders only (no LIMIT, STOP or STOP_LIMIT).
     */
    public record Features(
            boolean trading,
            boolean limitOrders,
            boolean simulatorPanel,
            boolean livePrices,
            boolean screener,
            boolean news,
            boolean calendar,
            boolean compare,
            boolean alerts,
            boolean riskView) {

        public boolean enabled(Feature feature) {
            return switch (feature) {
                case SCREENER -> screener;
                case NEWS -> news;
                case CALENDAR -> calendar;
                case COMPARE -> compare;
                case ALERTS -> alerts;
                case RISK_VIEW -> riskView;
            };
        }
    }

    /**
     * Per-broker limits, null = unlimited.
     *
     * @param maxOrderValue maximum value of one order, in the broker currency
     * @param maxOpenOrders maximum number of pending (limit/stop) orders per client; 0 = none allowed
     */
    public record Limits(java.math.BigDecimal maxOrderValue, Integer maxOpenOrders) {
    }

    public boolean allows(AssetClass assetClass) {
        return allowedAssetClasses.contains(assetClass);
    }
}
