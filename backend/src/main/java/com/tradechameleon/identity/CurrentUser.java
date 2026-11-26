package com.tradechameleon.identity;

import java.util.List;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Public API of the identity module: who is calling. Other modules never parse JWTs themselves.
 *
 * @param userId the token subject; stable for dev users and corporate SSO users alike
 */
public record CurrentUser(String userId, String name, String email, List<String> roles) {

    public static CurrentUser get() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken token)) {
            throw new IllegalStateException("No authenticated JWT user in the security context");
        }
        var jwt = token.getToken();
        List<String> roles = token.getAuthorities().stream()
                .map(a -> a.getAuthority().replaceFirst("^ROLE_", ""))
                .toList();
        return new CurrentUser(jwt.getSubject(), token.getName(), jwt.getClaimAsString("email"), roles);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
