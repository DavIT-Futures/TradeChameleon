package com.tradechameleon.tenant;

import com.tradechameleon.shared.DomainException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Works out which broker a request belongs to. First match wins:
 * <ol>
 *   <li>subdomain of {@code *.localhost}, e.g. {@code kestrel.localhost:8080}</li>
 *   <li>query parameter {@code ?tenant=kestrel}</li>
 *   <li>header {@code X-Tenant-Id: kestrel} (used by the SPAs, whose dev proxies rewrite the Host header)</li>
 *   <li>the configured default tenant</li>
 * </ol>
 * An explicitly requested but unknown tenant is a client error (400), not a silent fallback.
 */
@Component
public class TenantResolver {

    public static final String HEADER = "X-Tenant-Id";
    public static final String PARAM = "tenant";

    private final TenantDirectory directory;

    TenantResolver(TenantDirectory directory) {
        this.directory = directory;
    }

    public Tenant resolve(HttpServletRequest request) {
        return fromSubdomain(request.getServerName())
                .or(() -> explicit(request.getParameter(PARAM)))
                .or(() -> explicit(request.getHeader(HEADER)))
                .orElseGet(directory::defaultTenant);
    }

    private Optional<Tenant> fromSubdomain(String host) {
        if (host == null || !host.endsWith(".localhost")) {
            return Optional.empty();
        }
        String sub = host.substring(0, host.length() - ".localhost".length());
        // "kestrel.localhost" -> "kestrel"; "api.kestrel.localhost" -> "kestrel"
        String candidate = sub.contains(".") ? sub.substring(sub.lastIndexOf('.') + 1) : sub;
        return directory.find(candidate);
    }

    private Optional<Tenant> explicit(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(directory.find(id).orElseThrow(() -> new DomainException(HttpStatus.BAD_REQUEST,
                "unknown-tenant", "Unknown tenant", "No broker is registered under the id '" + id + "'.")));
    }
}
