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
                rs.getBoolean("feature_live_prices"));
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
                features);
    }

    private static Set<AssetClass> assetClasses(Array array) throws SQLException {
        var values = (String[]) array.getArray();
        return Arrays.stream(values).map(AssetClass::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(AssetClass.class)));
    }
}
