package com.tradechameleon.tenant;

import com.tradechameleon.shared.AssetClass;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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

    /**
     * Visual identity, rendered by the clients as CSS custom properties. The constraints matter when an
     * admin edits a broker: values end up in CSS and in the SVG logo, so only safe formats are accepted.
     */
    public record Theme(
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String primary,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String onPrimary,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String accent,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String background,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String surface,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String text,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String muted,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String positive,
            @NotBlank @Pattern(regexp = HEX, message = HEX_MESSAGE) String negative,
            @NotBlank @Pattern(regexp = "^([0-9]|[1-3][0-9])px$", message = "must be 0px to 39px") String radius,
            @NotBlank @Pattern(regexp = "^(light|dark)$", message = "must be light or dark") String colorScheme,
            @NotBlank @Size(max = 160) @Pattern(regexp = FONT, message = FONT_MESSAGE) String fontBody,
            @NotBlank @Size(max = 160) @Pattern(regexp = FONT, message = FONT_MESSAGE) String fontHeading) {

        static final String HEX = "^#[0-9a-fA-F]{6}$";
        static final String HEX_MESSAGE = "must be a colour like #1a2b3c";
        static final String FONT = "^[\\w \"',.-]+$";
        static final String FONT_MESSAGE = "must be a CSS font list such as \"Inter\", system-ui, sans-serif";
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
    public record Limits(
            @DecimalMin(value = "1", message = "must be at least 1 (leave empty for unlimited)") java.math.BigDecimal maxOrderValue,
            @Min(0) @Max(1000) Integer maxOpenOrders) {
    }

    /**
     * Logo URL with a version derived from everything the logo is drawn from. Browsers may cache the
     * SVG for an hour, so after an admin changes colours or the shape the URL changes too.
     */
    public String logoUrl() {
        return "/api/tenants/" + id + "/logo.svg?v="
                + Integer.toHexString(java.util.Objects.hash(name, logoShape, theme.primary(), theme.accent(), theme.onPrimary()));
    }

    public boolean allows(AssetClass assetClass) {
        return allowedAssetClasses.contains(assetClass);
    }
}
