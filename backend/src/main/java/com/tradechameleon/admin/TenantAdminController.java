package com.tradechameleon.admin;

import com.tradechameleon.tenant.TenantContext;
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
    private final UserManagement users;

    TenantAdminController(BrokerAdmin admin, UserManagement users) {
        this.admin = admin;
        this.users = users;
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
    // ---- users of this broker ----------------------------------------------------------------

    @GetMapping("/users")
    @Operation(summary = "Users of this broker")
    List<UserManagement.ManagedUser> users() {
        return users.list(TenantContext.current().id());
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a user at this broker", description = "Roles: TRADER, VIEWER, MAINTAINER. 409 if the e-mail is taken.")
    UserManagement.ManagedUser createUser(@Valid @RequestBody UserManagement.NewUser user, Authentication auth) {
        return users.create(TenantContext.current().id(), user, BrokerAdmin.actor(auth));
    }

    @PutMapping("/users/{userId}")
    @Operation(summary = "Change a user's name, roles, enabled flag or password",
            description = "422 self-lockout when you would disable yourself or drop your own MAINTAINER role.")
    UserManagement.ManagedUser updateUser(@PathVariable String userId,
                                          @Valid @RequestBody UserManagement.UserUpdate update, Authentication auth) {
        return users.update(TenantContext.current().id(), userId, update, subject(auth), BrokerAdmin.actor(auth));
    }

    @DeleteMapping("/users/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a user", description = "Open orders are cancelled, alerts and watchlist removed; account history is kept.")
    void deleteUser(@PathVariable String userId, Authentication auth) {
        users.delete(TenantContext.current().id(), userId, subject(auth), BrokerAdmin.actor(auth));
    }

    private static String subject(Authentication auth) {
        return auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwt
                ? jwt.getToken().getSubject() : null;
    }
}
