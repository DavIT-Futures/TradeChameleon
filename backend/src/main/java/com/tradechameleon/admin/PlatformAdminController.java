package com.tradechameleon.admin;

import com.tradechameleon.tenant.TenantSettings;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The platform console (super admin, role ADMIN): every broker, side by side, all editable. This is the
 * one deliberate exception to tenant isolation, so it has its own URL space, its own login
 * ({@code POST /api/platform/auth/token}) and its own front-end address (admin.localhost).
 */
@RestController
@RequestMapping("/api/platform")
@Tag(name = "Platform admin", description = "Super admin console: all brokers (role ADMIN, platform token)")
@SecurityRequirement(name = "bearer")
class PlatformAdminController {

    private final BrokerAdmin admin;

    PlatformAdminController(BrokerAdmin admin) {
        this.admin = admin;
    }

    @GetMapping("/tenants")
    @Operation(summary = "All brokers with configuration, feature flags, limits and usage")
    List<BrokerOverview> tenants() {
        return admin.all();
    }

    @PutMapping("/tenants/{id}")
    @Operation(summary = "Change any broker's settings",
            description = "Validated with Bean Validation (400 with an errors map) and business rules (422). "
                    + "The change is live for the next request; the diff is written to the audit log.")
    BrokerOverview update(@PathVariable String id, @Valid @RequestBody TenantSettings settings, Authentication auth) {
        return admin.update(id, settings, auth);
    }

    @GetMapping("/tenants/{id}/changes")
    @Operation(summary = "Audit log of a broker's settings, newest first")
    List<BrokerAdmin.TenantChange> changes(@PathVariable String id, @RequestParam(defaultValue = "20") int limit) {
        return admin.changes(id, limit);
    }

    @GetMapping("/settings-options")
    @Operation(summary = "Allowed values for the broker editor (currencies, asset classes, logo shapes)")
    BrokerAdmin.SettingsOptions options() {
        return admin.options();
    }
}
