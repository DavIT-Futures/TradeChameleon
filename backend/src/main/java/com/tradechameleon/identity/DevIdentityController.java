package com.tradechameleon.identity;

import com.tradechameleon.shared.DomainException;
import com.tradechameleon.tenant.Tenant;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The built-in development identity provider. It is deliberately tiny: it checks a password against
 * the {@code app_user} table and returns an RS256-signed JWT. It also publishes the two documents a
 * resource server (or any OIDC library) needs to trust it: the discovery document and the JWKS.
 *
 * <p>In production you switch {@code tc.security.mode} to {@code oidc}; this controller disappears and
 * tokens come from the corporate SSO instead.
 */
@RestController
@ConditionalOnProperty(name = "tc.security.mode", havingValue = "dev", matchIfMissing = true)
@Tag(name = "Auth", description = "Built-in development identity provider (RS256 JWT)")
class DevIdentityController {

    /** Claim that marks a platform console token (super admin); such tokens have no tenant. */
    static final String PLATFORM_CLAIM = "platform";

    /** A valid BCrypt hash used to keep response time constant when the user does not exist. */
    private static final String DUMMY_HASH = "{bcrypt}$2a$10$B5UiSXMlkg34inOSZx8v2eWvBq1B6P/U7selgJZIf4/DDV13OmnXm";

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtEncoder encoder;
    private final DevSigningKey key;
    private final SecurityProperties props;

    DevIdentityController(UserRepository users, PasswordEncoder passwords, JwtEncoder encoder, DevSigningKey key,
                          SecurityProperties props) {
        this.users = users;
        this.passwords = passwords;
        this.encoder = encoder;
        this.key = key;
        this.props = props;
    }

    record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    record TokenResponse(String accessToken, String tokenType, long expiresIn, UserProfile user) {
    }

    @PostMapping("/api/auth/token")
    @Operation(summary = "Exchange demo credentials for an RS256 access token",
            description = "Users: trader@<tenant>.test / viewer@<tenant>.test, password 'demo'. "
                    + "The tenant comes from the subdomain, ?tenant= or X-Tenant-Id.")
    TokenResponse token(@Valid @RequestBody LoginRequest request) {
        Tenant tenant = TenantContext.current();
        var user = users.findByTenantAndEmail(tenant.id(), request.username());
        boolean ok = passwords.matches(request.password(), user.map(UserRepository.UserRow::passwordHash).orElse(DUMMY_HASH));
        if (user.isEmpty() || !ok) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "invalid-credentials", "Invalid credentials",
                    "Unknown user or wrong password for broker '" + tenant.id() + "'.");
        }
        var u = user.get();
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(u.id().toString())
                .audience(List.of("tradechameleon-api"))
                .issuedAt(now)
                .expiresAt(now.plus(props.tokenTtl()))
                .claim("name", u.displayName())
                .claim("email", u.email())
                .claim(props.tenantClaim(), tenant.id())
                .claim(props.rolesClaim(), u.roles())
                .claim("scope", u.roles().contains("TRADER") ? "portfolio:read orders:write" : "portfolio:read")
                .build();
        var header = JwsHeader.with(SignatureAlgorithm.RS256).keyId(key.rsaKey().getKeyID()).type("JWT").build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        var profile = new UserProfile(u.id().toString(), u.displayName(), u.email(), u.roles(), tenant.id());
        return new TokenResponse(token, "Bearer", props.tokenTtl().toSeconds(), profile);
    }

    @PostMapping("/api/platform/auth/token")
    @Operation(summary = "Sign in to the platform console (super admin)",
            description = "User: admin@tradechameleon.com, password 'demo'. The token carries no tenant claim but "
                    + "platform=true, and is accepted only by /api/platform/**.")
    TokenResponse platformToken(@Valid @RequestBody LoginRequest request) {
        var user = users.findPlatformUser(request.username());
        boolean ok = passwords.matches(request.password(), user.map(UserRepository.UserRow::passwordHash).orElse(DUMMY_HASH));
        if (user.isEmpty() || !ok) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "invalid-credentials", "Invalid credentials",
                    "Unknown platform user or wrong password.");
        }
        var u = user.get();
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(u.id().toString())
                .audience(List.of("tradechameleon-platform"))
                .issuedAt(now)
                .expiresAt(now.plus(props.tokenTtl()))
                .claim("name", u.displayName())
                .claim("email", u.email())
                .claim(PLATFORM_CLAIM, true)
                .claim(props.rolesClaim(), u.roles())
                .claim("scope", "platform:admin")
                .build();
        var header = JwsHeader.with(SignatureAlgorithm.RS256).keyId(key.rsaKey().getKeyID()).type("JWT").build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        var profile = new UserProfile(u.id().toString(), u.displayName(), u.email(), u.roles(), null);
        return new TokenResponse(token, "Bearer", props.tokenTtl().toSeconds(), profile);
    }

    @GetMapping("/oauth2/jwks")
    @Operation(summary = "JSON Web Key Set with the public RS256 signing key")
    Map<String, Object> jwks() {
        return key.publicJwkSet().toJSONObject();
    }

    @GetMapping("/.well-known/openid-configuration")
    @Operation(summary = "Minimal OpenID Connect discovery document")
    Map<String, Object> discovery() {
        String iss = props.issuer();
        return Map.of(
                "issuer", iss,
                "jwks_uri", iss + "/oauth2/jwks",
                "token_endpoint", iss + "/api/auth/token",
                "response_types_supported", List.of("token"),
                "subject_types_supported", List.of("public"),
                "id_token_signing_alg_values_supported", List.of("RS256"),
                "claims_supported", List.of("sub", "name", "email", props.tenantClaim(), props.rolesClaim()));
    }
}
