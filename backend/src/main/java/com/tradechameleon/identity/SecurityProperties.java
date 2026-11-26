package com.tradechameleon.identity;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code tc.security.*}. Switching {@code mode} from {@code dev} to {@code oidc} and setting
 * {@code issuer-uri} replaces the built-in identity provider with a corporate SSO (Keycloak, Entra ID,
 * Okta, Auth0...). Nothing else in the code base changes: the API only ever sees validated JWTs.
 */
@ConfigurationProperties("tc.security")
public record SecurityProperties(
        Mode mode,
        String issuer,
        String issuerUri,
        Duration tokenTtl,
        String tenantClaim,
        String rolesClaim) {

    public enum Mode { DEV, OIDC }

    public SecurityProperties {
        if (mode == null) mode = Mode.DEV;
        if (issuer == null || issuer.isBlank()) issuer = "http://localhost:8080";
        if (tokenTtl == null) tokenTtl = Duration.ofHours(8);
        if (tenantClaim == null || tenantClaim.isBlank()) tenantClaim = "tenant";
        if (rolesClaim == null || rolesClaim.isBlank()) rolesClaim = "roles";
    }
}
