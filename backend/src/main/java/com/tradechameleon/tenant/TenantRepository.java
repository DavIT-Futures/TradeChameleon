package com.tradechameleon.tenant;

import com.tradechameleon.shared.AssetClass;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads tenants with Spring's fluent {@link JdbcClient}: plain SQL, explicit row mapping, no ORM. */
@Repository
class TenantRepository {

    private final JdbcClient jdbc;

    TenantRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<Tenant> findAll() {
        return jdbc.sql("select * from tenant order by id")
                .query((rs, rowNum) -> map(rs))
                .list();
    }

    void update(String id, TenantSettings s) {
        var t = s.theme();
        var f = s.features();
        jdbc.sql("""
                        update tenant set
                            name = :name, tagline = :tagline, locale = :locale, currency = :currency,
                            allowed_asset_classes = cast(:classes as text[]), spread_markup_bps = :markup,
                            logo_shape = :logo,
                            theme_primary = :primary, theme_on_primary = :onPrimary, theme_accent = :accent,
                            theme_background = :background, theme_surface = :surface, theme_text = :text,
                            theme_muted = :muted, theme_positive = :positive, theme_negative = :negative,
                            theme_radius = :radius, theme_color_scheme = :scheme, font_body = :fontBody,
                            font_heading = :fontHeading,
                            feature_trading = :trading, feature_limit_orders = :limitOrders,
                            feature_simulator_panel = :simulator, feature_live_prices = :livePrices,
                            feature_screener = :screener, feature_news = :news, feature_calendar = :calendar,
                            feature_compare = :compare, feature_alerts = :alerts, feature_risk_view = :riskView,
                            max_order_value = :maxOrderValue, max_open_orders = :maxOpenOrders
                        where id = :id
                        """)
                .param("id", id).param("name", s.name()).param("tagline", s.tagline())
                .param("locale", s.locale()).param("currency", s.currency())
                .param("classes", "{" + String.join(",", s.allowedAssetClasses().stream().map(Enum::name).distinct().toList()) + "}")
                .param("markup", s.spreadMarkupBps()).param("logo", s.logoShape())
                .param("primary", t.primary()).param("onPrimary", t.onPrimary()).param("accent", t.accent())
                .param("background", t.background()).param("surface", t.surface()).param("text", t.text())
                .param("muted", t.muted()).param("positive", t.positive()).param("negative", t.negative())
                .param("radius", t.radius()).param("scheme", t.colorScheme())
                .param("fontBody", t.fontBody()).param("fontHeading", t.fontHeading())
                .param("trading", f.trading()).param("limitOrders", f.limitOrders())
                .param("simulator", f.simulatorPanel()).param("livePrices", f.livePrices())
                .param("screener", f.screener()).param("news", f.news()).param("calendar", f.calendar())
                .param("compare", f.compare()).param("alerts", f.alerts()).param("riskView", f.riskView())
                .param("maxOrderValue", s.limits().maxOrderValue(), java.sql.Types.NUMERIC)
                .param("maxOpenOrders", s.limits().maxOpenOrders(), java.sql.Types.INTEGER)
                .update();
    }

    Tenant findById(String id) {
        return jdbc.sql("select * from tenant where id = ?").param(id).query((rs, n) -> map(rs)).single();
    }

    private static Tenant map(ResultSet rs) throws SQLException {
        var theme = new Tenant.Theme(
                rs.getString("theme_primary"),
                rs.getString("theme_on_primary"),
                rs.getString("theme_accent"),
                rs.getString("theme_background"),
                rs.getString("theme_surface"),
                rs.getString("theme_text"),
                rs.getString("theme_muted"),
                rs.getString("theme_positive"),
                rs.getString("theme_negative"),
                rs.getString("theme_radius"),
                rs.getString("theme_color_scheme"),
                rs.getString("font_body"),
                rs.getString("font_heading"));
        var features = new Tenant.Features(
                rs.getBoolean("feature_trading"),
                rs.getBoolean("feature_limit_orders"),
                rs.getBoolean("feature_simulator_panel"),
                rs.getBoolean("feature_live_prices"),
                rs.getBoolean("feature_screener"),
                rs.getBoolean("feature_news"),
                rs.getBoolean("feature_calendar"),
                rs.getBoolean("feature_compare"),
                rs.getBoolean("feature_alerts"),
                rs.getBoolean("feature_risk_view"));
        var limits = new Tenant.Limits(rs.getBigDecimal("max_order_value"),
                rs.getObject("max_open_orders") == null ? null : rs.getInt("max_open_orders"));
        return new Tenant(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("tagline"),
                rs.getString("locale"),
                rs.getString("currency"),
                assetClasses(rs.getArray("allowed_asset_classes")),
                rs.getInt("spread_markup_bps"),
                rs.getString("logo_shape"),
                theme,
                features,
                limits);
    }

    private static Set<AssetClass> assetClasses(Array array) throws SQLException {
        var values = (String[]) array.getArray();
        return Arrays.stream(values).map(AssetClass::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(AssetClass.class)));
    }
}
