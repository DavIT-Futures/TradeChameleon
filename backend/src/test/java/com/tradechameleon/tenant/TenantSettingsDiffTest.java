package com.tradechameleon.tenant;

import static org.assertj.core.api.Assertions.assertThat;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class TenantSettingsDiffTest {

    private static final Tenant.Theme THEME = new Tenant.Theme("#111111", "#ffffff", "#222222", "#f5f5f5", "#ffffff",
            "#000000", "#666666", "#00aa00", "#aa0000", "8px", "light", "system-ui", "system-ui");

    private static TenantSettings settings(String name, Tenant.Theme theme, boolean calendar, BigDecimal maxOrder) {
        return new TenantSettings(name, "", "en-GB", "GBP", List.of(AssetClass.STOCK), 5, "monogram", theme,
                new Tenant.Features(true, true, true, true, true, true, calendar, true, true, true),
                new Tenant.Limits(maxOrder, null));
    }

    @Test
    void reportsOnlyChangedLeavesWithDottedPaths() {
        var before = settings("Aurora", THEME, false, new BigDecimal("1000.00"));
        var after = settings("Aurora Pro",
                new Tenant.Theme("#333333", "#ffffff", "#222222", "#f5f5f5", "#ffffff", "#000000", "#666666",
                        "#00aa00", "#aa0000", "8px", "light", "system-ui", "system-ui"),
                true, new BigDecimal("1000"));

        assertThat(TenantDirectory.diff("", before, after)).containsExactly(
                "name: Aurora → Aurora Pro",
                "theme.primary: #111111 → #333333",
                "features.calendar: false → true");
    }

    @Test
    void identicalSettingsHaveNoDiff() {
        var s = settings("Aurora", THEME, true, null);
        assertThat(TenantDirectory.diff("", s, s)).isEmpty();
    }
}
