package com.tradechameleon.admin;

import com.tradechameleon.tenant.TenantContext;
import com.tradechameleon.tenant.TenantSettings;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The maintainer's admin page (role MAINTAINER): the broker of THIS request and nothing else.
 *
 * <p>There is deliberately no broker id in these URLs. The broker comes from the request (subdomain,
 * ?tenant= or X-Tenant-Id) and {@code TenantMatchFilter} has already rejected a token issued for another
 * broker (403 tenant-mismatch), so a maintainer of Pulse simply has no way to address Kestrel.
 */
@RestController
@RequestMapping("/api/tenant-admin")
@Tag(name = "Broker admin", description = "Maintainer of one broker: its own settings only (role MAINTAINER)")
@SecurityRequirement(name = "bearer")
class TenantAdminController {

    private final BrokerAdmin admin;

    TenantAdminController(BrokerAdmin admin) {
        this.admin = admin;
    }

    @GetMapping("/broker")
    @Operation(summary = "This broker's configuration, feature flags, limits and usage")
    BrokerOverview broker() {
        return admin.one(TenantContext.current().id());
    }

    @PutMapping("/broker")
    @Operation(summary = "Change this broker's settings",
            description = "Same validation and audit as the platform console, limited to the broker of the request.")
    BrokerOverview update(@Valid @RequestBody TenantSettings settings, Authentication auth) {
        return admin.update(TenantContext.current().id(), settings, auth);
    }

    @GetMapping("/changes")
    @Operation(summary = "Audit log of this broker's settings, newest first")
    List<BrokerAdmin.TenantChange> changes(@RequestParam(defaultValue = "20") int limit) {
        return admin.changes(TenantContext.current().id(), limit);
    }

    @GetMapping("/settings-options")
    @Operation(summary = "Allowed values for the broker editor (currencies, asset classes, logo shapes)")
    BrokerAdmin.SettingsOptions options() {
        return admin.options();
    }
}
