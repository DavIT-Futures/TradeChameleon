package com.tradechameleon.identity;

import com.tradechameleon.shared.DomainException;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public API of the identity module for administrators: the users of ONE broker. Which broker a caller
 * may manage is decided by the admin module's controllers (a maintainer: only their own; the platform
 * admin: any). This service only enforces the rules that hold for everybody:
 * <ul>
 *   <li>roles are TRADER, VIEWER and MAINTAINER only (ADMIN exists on the platform, never on a broker),</li>
 *   <li>an e-mail is unique per broker (409),</li>
 *   <li>nobody can lock themselves out: no deleting or disabling yourself, no dropping your own MAINTAINER role (422).</li>
 * </ul>
 * Every change publishes {@link UserAccountsChanged} for the audit log; a deletion also publishes
 * {@link UserDeleted} so other modules can clean up (open orders, alerts, watchlist).
 */
@Service
public class UserManagement {

    /** Roles an administrator can give to a broker's user. */
    public enum Role { TRADER, VIEWER, MAINTAINER }

    /** A broker's user as the admin pages show it (never the password hash). */
    public record ManagedUser(String id, String email, String name, List<Role> roles, boolean enabled, Instant createdAt) {
    }

    public record NewUser(
            @NotBlank @Email @Size(max = 160) String email,
            @NotBlank @Size(max = 80) String name,
            @NotBlank @Size(min = 4, max = 72, message = "must be 4 to 72 characters") String password,
            @NotEmpty(message = "pick at least one role") List<Role> roles) {
    }

    /** @param password a new password, or null/blank to keep the current one */
    public record UserUpdate(
            @NotBlank @Size(max = 80) String name,
            @NotEmpty(message = "pick at least one role") List<Role> roles,
            boolean enabled,
            @Size(min = 4, max = 72, message = "must be 4 to 72 characters") String password) {
    }

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final ApplicationEventPublisher events;

    UserManagement(UserRepository users, PasswordEncoder passwords, ApplicationEventPublisher events) {
        this.users = users;
        this.passwords = passwords;
        this.events = events;
    }

    public List<ManagedUser> list(String tenantId) {
        return users.findAll(tenantId).stream().map(UserManagement::view).toList();
    }

    @Transactional
    public ManagedUser create(String tenantId, NewUser req, String actor) {
        if (users.findByTenantAndEmail(tenantId, req.email()).isPresent()) {
            throw new DomainException(HttpStatus.CONFLICT, "email-taken", "E-mail already used",
                    req.email() + " already has an account at this broker.");
        }
        var row = new UserRepository.UserRow(UUID.randomUUID(), tenantId, req.email().trim().toLowerCase(),
                req.name().trim(), passwords.encode(req.password()), names(req.roles()), true, Instant.now());
        users.insert(row);
        audit(tenantId, actor, List.of("user created: " + row.email() + " " + row.roles()));
        return view(row);
    }

    @Transactional
    public ManagedUser update(String tenantId, String userId, UserUpdate req, String actorId, String actor) {
        var before = find(tenantId, userId);
        if (before.id().toString().equals(actorId)) {
            if (!req.enabled()) {
                throw selfLockout("You cannot disable your own account.");
            }
            if (before.roles().contains("MAINTAINER") && !req.roles().contains(Role.MAINTAINER)) {
                throw selfLockout("You cannot remove your own MAINTAINER role.");
            }
        }
        boolean newPassword = req.password() != null && !req.password().isBlank();
        var after = new UserRepository.UserRow(before.id(), tenantId, before.email(), req.name().trim(),
                newPassword ? passwords.encode(req.password()) : before.passwordHash(), names(req.roles()),
                req.enabled(), before.createdAt());
        users.update(after);

        var changes = new ArrayList<String>();
        if (!before.displayName().equals(after.displayName())) {
            changes.add("user " + before.email() + " name: " + before.displayName() + " → " + after.displayName());
        }
        if (!before.roles().equals(after.roles())) {
            changes.add("user " + before.email() + " roles: " + before.roles() + " → " + after.roles());
        }
        if (before.enabled() != after.enabled()) {
            changes.add("user " + before.email() + (after.enabled() ? " enabled" : " disabled"));
        }
        if (newPassword) {
            changes.add("user " + before.email() + " password reset");
        }
        if (!changes.isEmpty()) {
            audit(tenantId, actor, changes);
        }
        return view(after);
    }

    @Transactional
    public void delete(String tenantId, String userId, String actorId, String actor) {
        var user = find(tenantId, userId);
        if (user.id().toString().equals(actorId)) {
            throw selfLockout("You cannot delete your own account.");
        }
        users.delete(user.id());
        audit(tenantId, actor, List.of("user deleted: " + user.email()));
        events.publishEvent(new UserDeleted(tenantId, user.id().toString(), user.email()));
    }

    private UserRepository.UserRow find(String tenantId, String userId) {
        UUID id;
        try {
            id = UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            throw DomainException.notFound("User", userId);
        }
        return users.findById(tenantId, id).orElseThrow(() -> DomainException.notFound("User", userId));
    }

    private void audit(String tenantId, String actor, List<String> changes) {
        events.publishEvent(new UserAccountsChanged(tenantId, actor, Instant.now(), changes));
    }

    private static DomainException selfLockout(String detail) {
        return DomainException.unprocessable("self-lockout", "You would lock yourself out", detail, Map.of());
    }

    private static List<String> names(List<Role> roles) {
        return roles.stream().distinct().sorted().map(Enum::name).toList();
    }

    private static ManagedUser view(UserRepository.UserRow u) {
        return new ManagedUser(u.id().toString(), u.email(), u.displayName(),
                u.roles().stream().map(Role::valueOf).toList(), u.enabled(), u.createdAt());
    }
}
