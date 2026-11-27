package com.tradechameleon.admin;

import com.tradechameleon.tenant.TenantSettings;
import com.tradechameleon.identity.UserManagement;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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
    private final UserManagement users;
    private final com.tradechameleon.tenant.TenantDirectory tenants;

    PlatformAdminController(BrokerAdmin admin, UserManagement users, com.tradechameleon.tenant.TenantDirectory tenants) {
        this.admin = admin;
        this.users = users;
        this.tenants = tenants;
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
    // ---- users of any broker ----------------------------------------------------------------

    @GetMapping("/tenants/{id}/users")
    @Operation(summary = "Users of a broker")
    List<UserManagement.ManagedUser> users(@PathVariable String id) {
        return users.list(tenants.get(id).id());
    }

    @PostMapping("/tenants/{id}/users")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a user at a broker", description = "Roles: TRADER, VIEWER, MAINTAINER. 409 if the e-mail is taken.")
    UserManagement.ManagedUser createUser(@PathVariable String id, @Valid @RequestBody UserManagement.NewUser user, Authentication auth) {
        return users.create(tenants.get(id).id(), user, BrokerAdmin.actor(auth));
    }

    @PutMapping("/tenants/{id}/users/{userId}")
    @Operation(summary = "Change a user's name, roles, enabled flag or password",
            description = "422 self-lockout when you would disable yourself or drop your own MAINTAINER role.")
    UserManagement.ManagedUser updateUser(@PathVariable String id, @PathVariable String userId,
                                          @Valid @RequestBody UserManagement.UserUpdate update, Authentication auth) {
        return users.update(tenants.get(id).id(), userId, update, subject(auth), BrokerAdmin.actor(auth));
    }

    @DeleteMapping("/tenants/{id}/users/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a user", description = "Open orders are cancelled, alerts and watchlist removed; account history is kept.")
    void deleteUser(@PathVariable String id, @PathVariable String userId, Authentication auth) {
        users.delete(tenants.get(id).id(), userId, subject(auth), BrokerAdmin.actor(auth));
    }

    private static String subject(Authentication auth) {
        return auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwt
                ? jwt.getToken().getSubject() : null;
    }
}
