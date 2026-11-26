package com.tradechameleon.tenant;

import com.tradechameleon.shared.AssetClass;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public branding endpoints used by the login screen brand switcher and by the theming code. */
@RestController
@RequestMapping("/api/tenants")
@Tag(name = "Tenants", description = "White-label brokers and their branding")
class TenantController {

    private final TenantDirectory directory;
    private final LogoGenerator logos;

    TenantController(TenantDirectory directory, LogoGenerator logos) {
        this.directory = directory;
        this.logos = logos;
    }

    @GetMapping
    @Operation(summary = "List all brokers (for the brand switcher)")
    List<TenantDto> list() {
        return directory.all().stream().map(TenantDto::from).toList();
    }

    @GetMapping("/current")
    @Operation(summary = "Broker resolved for this request (subdomain, ?tenant=, X-Tenant-Id or default)")
    TenantDto current() {
        return TenantDto.from(TenantContext.current());
    }

    @GetMapping("/{id}")
    @Operation(summary = "One broker by id")
    TenantDto get(@PathVariable String id) {
        return TenantDto.from(directory.get(id));
    }

    @GetMapping(value = "/{id}/logo.svg", produces = "image/svg+xml")
    @Operation(summary = "Generated SVG logo of a broker")
    ResponseEntity<String> logo(@PathVariable String id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(logos.svg(directory.get(id)));
    }

    /** API representation: the tenant plus a ready-to-use logo URL. */
    record TenantDto(
            String id,
            String name,
            String tagline,
            String locale,
            String currency,
            List<AssetClass> allowedAssetClasses,
            int spreadMarkupBps,
            String logoUrl,
            Tenant.Theme theme,
            Tenant.Features features) {

        static TenantDto from(Tenant t) {
            return new TenantDto(t.id(), t.name(), t.tagline(), t.locale(), t.currency(),
                    t.allowedAssetClasses().stream().sorted().toList(),
                    t.spreadMarkupBps(), "/api/tenants/" + t.id() + "/logo.svg", t.theme(), t.features());
        }
    }
}
