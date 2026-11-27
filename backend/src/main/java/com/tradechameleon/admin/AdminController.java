package com.tradechameleon.admin;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.tenant.Tenant;
import com.tradechameleon.tenant.TenantDirectory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform operator view across ALL brokers (role ADMIN). This is the one deliberate exception to
 * tenant isolation, so it is read-only and lives in its own module.
 *
 * <p>The usage figures come from a few aggregate SQL queries over other modules' tables. That is a
 * pragmatic reporting read model: it never writes and does not call other modules' internals, so
 * Spring Modulith's architecture rules still hold.
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin", description = "Platform operator view of all brokers (role ADMIN)")
@SecurityRequirement(name = "bearer")
class AdminController {

    private record Usage(int users, int traders, int viewers, int openOrders, int filledOrders, BigDecimal cash) {
    }

    private final TenantDirectory tenants;
    private final MarketData market;
    private final JdbcClient jdbc;

    AdminController(TenantDirectory tenants, MarketData market, JdbcClient jdbc) {
        this.tenants = tenants;
        this.market = market;
        this.jdbc = jdbc;
    }

    @GetMapping("/tenants")
    @Operation(summary = "All brokers with configuration, feature flags, limits and usage")
    List<BrokerOverview> tenants() {
        Map<String, Usage> usage = usage();
        return tenants.all().stream().map(t -> overview(t, usage.getOrDefault(t.id(),
                new Usage(0, 0, 0, 0, 0, BigDecimal.ZERO)))).toList();
    }

    private BrokerOverview overview(Tenant t, Usage u) {
        var offered = market.instruments(t);
        int chains = t.allows(AssetClass.OPTION) ? (int) offered.stream().filter(i -> i.optionable()).count() : 0;
        return new BrokerOverview(t.id(), t.name(), t.tagline(), t.locale(), t.currency(),
                "/api/tenants/" + t.id() + "/logo.svg", t.theme(),
                t.allowedAssetClasses().stream().sorted().toList(), t.spreadMarkupBps(), t.features(), t.limits(),
                offered.size(), chains, u.users(), u.traders(), u.viewers(), u.openOrders(), u.filledOrders(),
                u.cash().setScale(2, RoundingMode.HALF_UP));
    }

    private Map<String, Usage> usage() {
        Map<String, int[]> counts = new HashMap<>();
        jdbc.sql("""
                        select tenant_id, count(*) as users,
                               count(*) filter (where 'TRADER' = any(roles)) as traders,
                               count(*) filter (where 'VIEWER' = any(roles)) as viewers
                        from app_user group by tenant_id
                        """)
                .query((rs, n) -> counts.put(rs.getString("tenant_id"),
                        new int[] {rs.getInt("users"), rs.getInt("traders"), rs.getInt("viewers"), 0, 0}))
                .list();
        jdbc.sql("""
                        select tenant_id,
                               count(*) filter (where status = 'OPEN') as open_orders,
                               count(*) filter (where status = 'FILLED') as filled_orders
                        from trade_order group by tenant_id
                        """)
                .query((rs, n) -> {
                    int[] c = counts.computeIfAbsent(rs.getString("tenant_id"), k -> new int[5]);
                    c[3] = rs.getInt("open_orders");
                    c[4] = rs.getInt("filled_orders");
                    return c;
                })
                .list();
        Map<String, BigDecimal> cash = new HashMap<>();
        jdbc.sql("select tenant_id, sum(cash) as cash from account group by tenant_id")
                .query((rs, n) -> cash.put(rs.getString("tenant_id"), rs.getBigDecimal("cash")))
                .list();
        Map<String, Usage> result = new HashMap<>();
        counts.forEach((tenant, c) -> result.put(tenant,
                new Usage(c[0], c[1], c[2], c[3], c[4], cash.getOrDefault(tenant, BigDecimal.ZERO))));
        return result;
    }
}
