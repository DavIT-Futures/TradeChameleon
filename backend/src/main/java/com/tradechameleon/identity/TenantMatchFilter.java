package com.tradechameleon.identity;

import com.tradechameleon.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Tenant isolation at the edge: a token issued for broker A must never be used against broker B.
 * Runs right after the bearer token has been validated. Tokens without a tenant claim (e.g. from a
 * corporate SSO that does not know about tenants) are accepted for the request's tenant.
 */
class TenantMatchFilter extends OncePerRequestFilter {

    private final SecurityProperties props;
    private final ProblemSecurityHandlers problems;

    TenantMatchFilter(SecurityProperties props, ProblemSecurityHandlers problems) {
        this.props = props;
        this.problems = problems;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt && TenantContext.isBound()) {
            String tokenTenant = jwt.getToken().getClaimAsString(props.tenantClaim());
            String requestTenant = TenantContext.current().id();
            if (tokenTenant != null && !tokenTenant.equals(requestTenant)) {
                problems.write(request, response, HttpStatus.FORBIDDEN, "tenant-mismatch", "Tenant mismatch",
                        "The token was issued for tenant '" + tokenTenant + "' but the request targets '"
                                + requestTenant + "'.");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
