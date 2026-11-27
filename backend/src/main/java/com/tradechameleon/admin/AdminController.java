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
import com.tradechameleon.shared.FxRates;
import com.tradechameleon.tenant.LogoGenerator;
import com.tradechameleon.tenant.TenantSettings;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Arrays;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @PutMapping("/tenants/{id}")
    @Operation(summary = "Change a broker's settings (branding, locale, currency, asset classes, spread, features, limits)",
            description = "Validated with Bean Validation (400 with an errors map) and business rules (422). "
                    + "The change is live for the next request; the diff is written to the audit log.")
    BrokerOverview update(@PathVariable String id, @Valid @RequestBody TenantSettings settings, Authentication auth) {
        String who = auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwt
                && jwt.getToken().getClaimAsString("email") != null
                ? jwt.getToken().getClaimAsString("email") : auth.getName();
        Tenant updated = tenants.update(id, settings, who);
        return overview(updated, usage().getOrDefault(updated.id(), new Usage(0, 0, 0, 0, 0, BigDecimal.ZERO)));
    }

    @GetMapping("/settings-options")
    @Operation(summary = "Allowed values for the broker editor (currencies, asset classes, logo shapes)")
    SettingsOptions options() {
        return new SettingsOptions(List.copyOf(FxRates.supported()),
                Arrays.stream(AssetClass.values()).toList(), LogoGenerator.SHAPES);
    }

    @GetMapping("/tenants/{id}/changes")
    @Operation(summary = "Audit log of a broker's settings, newest first")
    List<TenantChange> changes(@PathVariable String id, @RequestParam(defaultValue = "20") int limit) {
        tenants.get(id);
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

    /** Allowed values for selects in the editor. */
    record SettingsOptions(List<String> currencies, List<AssetClass> assetClasses, List<String> logoShapes) {
    }

    /** One audit entry: who changed what and when. */
    record TenantChange(String changedBy, Instant changedAt, List<String> changes) {
    }

    private BrokerOverview overview(Tenant t, Usage u) {
        var offered = market.instruments(t);
        int chains = t.allows(AssetClass.OPTION) ? (int) offered.stream().filter(i -> i.optionable()).count() : 0;
        return new BrokerOverview(t.id(), t.name(), t.tagline(), t.locale(), t.currency(),
                t.logoUrl(), t.logoShape(), t.theme(),
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
