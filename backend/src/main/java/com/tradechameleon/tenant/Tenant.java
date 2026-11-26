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
        Features features) {

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

    /** Feature flags. A broker with {@code trading=false} is a portfolio-only (read-only) brand. */
    public record Features(
            boolean trading,
            boolean limitOrders,
            boolean simulatorPanel,
            boolean livePrices) {
    }

    public boolean allows(AssetClass assetClass) {
        return allowedAssetClasses.contains(assetClass);
    }
}
