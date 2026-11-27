package com.tradechameleon.admin;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.shared.FxRates;
import com.tradechameleon.tenant.LogoGenerator;
import com.tradechameleon.tenant.Tenant;
import com.tradechameleon.tenant.TenantDirectory;
import com.tradechameleon.tenant.TenantSettings;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

/**
 * What both administrative levels can do with a broker: read its configuration and usage, change its
 * settings and read its audit log. WHO may touch WHICH broker is decided by the two controllers:
 * {@link PlatformAdminController} (all brokers, role ADMIN) and {@link TenantAdminController} (only the
 * broker of the request, role MAINTAINER).
 *
 * <p>The usage figures come from a few aggregate SQL queries over other modules' tables: a read-only
 * reporting model that never calls other modules' internals.
 */
@Service
class BrokerAdmin {

    private record Usage(int users, int traders, int viewers, int maintainers, int openOrders, int filledOrders,
                         BigDecimal cash) {
        static final Usage NONE = new Usage(0, 0, 0, 0, 0, 0, BigDecimal.ZERO);
    }

    /** Allowed values for the selects in the editor. */
    record SettingsOptions(List<String> currencies, List<AssetClass> assetClasses, List<String> logoShapes) {
    }

    /** One audit entry: who changed what and when. */
    record TenantChange(String changedBy, Instant changedAt, List<String> changes) {
    }

    private final TenantDirectory tenants;
    private final MarketData market;
    private final JdbcClient jdbc;

    BrokerAdmin(TenantDirectory tenants, MarketData market, JdbcClient jdbc) {
        this.tenants = tenants;
        this.market = market;
        this.jdbc = jdbc;
    }

    List<BrokerOverview> all() {
        Map<String, Usage> usage = usage();
        return tenants.all().stream().map(t -> overview(t, usage.getOrDefault(t.id(), Usage.NONE))).toList();
    }

    BrokerOverview one(String id) {
        Tenant t = tenants.get(id);
        return overview(t, usage().getOrDefault(t.id(), Usage.NONE));
    }

    BrokerOverview update(String id, TenantSettings settings, Authentication auth) {
        Tenant updated = tenants.update(id, settings, actor(auth));
        return one(updated.id());
    }

    SettingsOptions options() {
        return new SettingsOptions(List.copyOf(FxRates.supported()),
                Arrays.stream(AssetClass.values()).toList(), LogoGenerator.SHAPES);
    }

    List<TenantChange> changes(String id, int limit) {
        tenants.get(id); // 404 for an unknown broker
        return jdbc.sql("""
                        select changed_by, changed_at, changes from tenant_change
                        where tenant_id = ? order by changed_at desc limit ?
                        """)
                .params(id, Math.clamp(limit, 1, 100))
                .query((rs, n) -> new TenantChange(rs.getString("changed_by"),
                        rs.getTimestamp("changed_at").toInstant(),
                        List.of((String[]) rs.getArray("changes").getArray())))
                .list();
    }

    /** The e-mail of the caller for the audit log (the display name if the token has no e-mail). */
    private static String actor(Authentication auth) {
        if (auth instanceof JwtAuthenticationToken jwt && jwt.getToken().getClaimAsString("email") != null) {
            return jwt.getToken().getClaimAsString("email");
        }
        return auth.getName();
    }

    private BrokerOverview overview(Tenant t, Usage u) {
        var offered = market.instruments(t);
        int chains = t.allows(AssetClass.OPTION) ? (int) offered.stream().filter(i -> i.optionable()).count() : 0;
        return new BrokerOverview(t.id(), t.name(), t.tagline(), t.locale(), t.currency(),
                t.logoUrl(), t.logoShape(), t.theme(),
                t.allowedAssetClasses().stream().sorted().toList(), t.spreadMarkupBps(), t.features(), t.limits(),
                offered.size(), chains, u.users(), u.traders(), u.viewers(), u.maintainers(), u.openOrders(),
                u.filledOrders(), u.cash().setScale(2, RoundingMode.HALF_UP));
    }

    private Map<String, Usage> usage() {
        Map<String, int[]> counts = new HashMap<>();
        jdbc.sql("""
                        select tenant_id, count(*) as users,
                               count(*) filter (where 'TRADER' = any(roles)) as traders,
                               count(*) filter (where 'VIEWER' = any(roles) and not 'MAINTAINER' = any(roles)) as viewers,
                               count(*) filter (where 'MAINTAINER' = any(roles)) as maintainers
                        from app_user group by tenant_id
                        """)
                .query((rs, n) -> counts.put(rs.getString("tenant_id"), new int[] {rs.getInt("users"),
                        rs.getInt("traders"), rs.getInt("viewers"), rs.getInt("maintainers"), 0, 0}))
                .list();
        jdbc.sql("""
                        select tenant_id,
                               count(*) filter (where status = 'OPEN') as open_orders,
                               count(*) filter (where status = 'FILLED') as filled_orders
                        from trade_order group by tenant_id
                        """)
                .query((rs, n) -> {
                    int[] c = counts.computeIfAbsent(rs.getString("tenant_id"), k -> new int[6]);
                    c[4] = rs.getInt("open_orders");
                    c[5] = rs.getInt("filled_orders");
                    return c;
                })
                .list();
        Map<String, BigDecimal> cash = new HashMap<>();
        jdbc.sql("select tenant_id, sum(cash) as cash from account group by tenant_id")
                .query((rs, n) -> cash.put(rs.getString("tenant_id"), rs.getBigDecimal("cash")))
                .list();
        Map<String, Usage> result = new HashMap<>();
        counts.forEach((tenant, c) -> result.put(tenant,
                new Usage(c[0], c[1], c[2], c[3], c[4], c[5], cash.getOrDefault(tenant, BigDecimal.ZERO))));
        return result;
    }
}
