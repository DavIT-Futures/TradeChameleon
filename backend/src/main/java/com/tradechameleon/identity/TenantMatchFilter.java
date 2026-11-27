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

    private static boolean isPublic(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        var matcher = new org.springframework.util.AntPathMatcher();
        for (String pattern : SecurityConfig.PUBLIC) {
            if (matcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) {
            // Platform console tokens (super admin) belong to /api/platform/** and nowhere else:
            // they have no tenant, so on a broker's endpoints they would act on the default broker.
            boolean platformToken = Boolean.TRUE.equals(jwt.getToken().getClaimAsBoolean(DevIdentityController.PLATFORM_CLAIM));
            boolean platformPath = request.getRequestURI().startsWith(request.getContextPath() + "/api/platform/");
            if (platformToken != platformPath && !isPublic(request)) {
                problems.write(request, response, HttpStatus.FORBIDDEN, "wrong-audience", "Wrong kind of token",
                        platformToken
                                ? "A platform console token can only be used on /api/platform/**."
                                : "The platform console needs a platform token (POST /api/platform/auth/token).");
                return;
            }
        }
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
