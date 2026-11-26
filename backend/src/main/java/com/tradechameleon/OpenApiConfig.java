package com.tradechameleon;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3.1 document at {@code /v3/api-docs}, rendered by Swagger UI ({@code /swagger-ui.html}) and
 * Scalar ({@code /scalar}). Both front-ends generate their TypeScript types from this document.
 */
@Configuration(proxyBeanMethods = false)
class OpenApiConfig {

    @Bean
    OpenAPI tradeChameleonOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("TradeChameleon API")
                        .version("1.0")
                        .description("""
                                Multi-tenant, white-label training trading platform.

                                **Tenant** is resolved from the `*.localhost` subdomain, `?tenant=`, the `X-Tenant-Id` \
                                header or the default (aurora).

                                **Auth**: `POST /api/auth/token` with `trader@aurora.test` / `demo`, then use the \
                                `accessToken` as a Bearer token. Errors are RFC 9457 Problem Details.""")
                        .license(new License().name("MIT")))
                .components(new Components().addSecuritySchemes("bearer", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("RS256 JWT from POST /api/auth/token (dev) or from your corporate SSO (oidc)")));
    }

    /** Documents the optional tenant header on every operation so it can be set from Swagger UI. */
    @Bean
    OperationCustomizer tenantHeader() {
        return (operation, handlerMethod) -> operation.addParametersItem(new HeaderParameter()
                .name("X-Tenant-Id")
                .required(false)
                .description("Broker id (aurora, kestrel, wisla, sakura). Optional: subdomain or ?tenant= work too.")
                .schema(new StringSchema()));
    }
}
