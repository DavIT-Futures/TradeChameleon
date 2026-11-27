package com.tradechameleon.tenant;

import com.tradechameleon.shared.AssetClass;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Everything an admin may change about a broker. The id is the URL key and never changes (users,
 * accounts and orders reference it). Bean Validation checks the shape; {@link TenantDirectory#update}
 * checks what needs knowledge of the system (supported currencies, logo shapes).
 */
public record TenantSettings(
        @NotBlank @Size(max = 80) String name,
        @NotNull @Size(max = 160) String tagline,
        @NotBlank @Pattern(regexp = "^[a-z]{2}-[A-Z]{2}$", message = "must be a locale like en-GB") String locale,
        @NotBlank @Pattern(regexp = "^[A-Z]{3}$", message = "must be an ISO currency code like EUR") String currency,
        @NotEmpty(message = "pick at least one asset class") List<AssetClass> allowedAssetClasses,
        @Min(0) @Max(500) int spreadMarkupBps,
        @NotBlank String logoShape,
        @NotNull @Valid Tenant.Theme theme,
        @NotNull Tenant.Features features,
        @NotNull @Valid Tenant.Limits limits) {

    public static TenantSettings of(Tenant t) {
        return new TenantSettings(t.name(), t.tagline(), t.locale(), t.currency(),
                t.allowedAssetClasses().stream().sorted().toList(), t.spreadMarkupBps(), t.logoShape(),
                t.theme(), t.features(), t.limits());
    }
}
