package com.tradechameleon.identity;

import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.util.Collection;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * The API is a stateless OAuth2 resource server: every protected call carries
 * {@code Authorization: Bearer <JWT>} signed with RS256.
 *
 * <p>Where the token comes from is pluggable:
 * <ul>
 *   <li>{@code tc.security.mode=dev} (default): the built-in {@link DevIdentityController} signs tokens
 *       with an in-memory RSA key and the decoder verifies them with the matching public key.</li>
 *   <li>{@code tc.security.mode=oidc}: tokens come from a corporate SSO. The decoder downloads the
 *       issuer's OIDC discovery document and JWKS from {@code tc.security.issuer-uri}.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
class SecurityConfig {

    static final String[] PUBLIC = {
            "/api/auth/**", "/api/tenants/**", "/api/market/**",
            "/.well-known/**", "/oauth2/jwks",
            "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/scalar/**",
            "/actuator/health/**", "/error"
    };

    @Bean
    SecurityFilterChain api(HttpSecurity http, SecurityProperties props, ProblemSecurityHandlers problems)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())                 // no cookies, no CSRF: bearer tokens only
                .cors(cors -> {})
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(PUBLIC).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/orders/**").hasRole("TRADER")
                        .requestMatchers(HttpMethod.DELETE, "/api/orders/**").hasRole("TRADER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/portfolio/**").hasRole("TRADER")
                        .requestMatchers(HttpMethod.PUT, "/api/portfolio/**").hasRole("TRADER")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(rs -> rs
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter(props)))
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems))
                .addFilterAfter(new TenantMatchFilter(props, problems), BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    /** Maps the {@code roles} claim (e.g. ["TRADER"]) to Spring authorities (ROLE_TRADER). */
    static Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter(SecurityProperties props) {
        return jwt -> {
            Collection<GrantedAuthority> authorities = jwt.getClaimAsStringList(props.rolesClaim()) == null
                    ? List.of()
                    : jwt.getClaimAsStringList(props.rolesClaim()).stream()
                            .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r.toUpperCase()))
                            .toList();
            String name = jwt.getClaimAsString("name");
            return new JwtAuthenticationToken(jwt, authorities, name != null ? name : jwt.getSubject());
        };
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        // Dev front-ends: localhost and any *.localhost brand subdomain, any port.
        config.setAllowedOriginPatterns(List.of("http://localhost:[*]", "http://*.localhost:[*]", "http://127.0.0.1:[*]"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Tenant-Id", "Last-Event-ID"));
        config.setExposedHeaders(List.of("X-Tenant-Id", "Location"));
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    // ---- token infrastructure ------------------------------------------------------------

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(name = "tc.security.mode", havingValue = "dev", matchIfMissing = true)
    static class DevMode {

        @Bean
        DevSigningKey devSigningKey() {
            return DevSigningKey.generate();
        }

        @Bean
        JwtEncoder jwtEncoder(DevSigningKey key) {
            return new NimbusJwtEncoder(new ImmutableJWKSet<>(new com.nimbusds.jose.jwk.JWKSet(key.rsaKey())));
        }

        @Bean
        JwtDecoder jwtDecoder(DevSigningKey key, SecurityProperties props) {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(key.publicKey()).build();
            OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefaultWithIssuer(props.issuer()));
            decoder.setJwtValidator(validator);
            return decoder;
        }
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(name = "tc.security.mode", havingValue = "oidc")
    static class OidcMode {

        /** Discovers the corporate IdP (/.well-known/openid-configuration) and validates iss + exp + signature. */
        @Bean
        JwtDecoder jwtDecoder(SecurityProperties props) {
            return JwtDecoders.fromIssuerLocation(props.issuerUri());
        }
    }
}
