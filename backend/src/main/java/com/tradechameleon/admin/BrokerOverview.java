package com.tradechameleon.admin;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.util.List;

/**
 * One broker as the platform operator sees it: configuration (branding, classes, flags, limits) side by
 * side with live usage figures. The admin panel renders six of these as a comparison matrix.
 *
 * @param instruments   instruments the broker offers (after its asset class filter)
 * @param optionChains  underlyings with an option chain (0 when the broker does not offer options)
 * @param totalCash     sum of client cash, broker currency
 */
public record BrokerOverview(
        String id,
        String name,
        String tagline,
        String locale,
        String currency,
        String logoUrl,
        String logoShape,
        Tenant.Theme theme,
        List<AssetClass> allowedAssetClasses,
        int spreadMarkupBps,
        Tenant.Features features,
        Tenant.Limits limits,
        int instruments,
        int optionChains,
        int users,
        int traders,
        int viewers,
        int openOrders,
        int filledOrders,
        BigDecimal totalCash) {
}
