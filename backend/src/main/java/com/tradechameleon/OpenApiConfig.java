package com.tradechameleon;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import io.swagger.v3.oas.models.media.Schema;
import org.springdoc.core.customizers.OpenApiCustomizer;
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

    /**
     * Java records have no "optional" fields: every component is always serialised. Mark all properties
     * as required so the generated TypeScript types are {@code symbol: string} rather than
     * {@code symbol?: string}. The few fields that can be {@code null} are listed explicitly and typed
     * as {@code T | null} (OpenAPI 3.1 type arrays).
     */
    private static final Set<String> NULLABLE = Set.of(
            "Order.limitPrice", "Order.stopPrice", "Order.stopLoss", "Order.takeProfit", "Order.fillPrice",
            "Order.rejectReason",
            "PlaceOrderRequest.limitPrice", "PlaceOrderRequest.stopPrice", "PlaceOrderRequest.stopLoss",
            "PlaceOrderRequest.takeProfit",
            "PositionView.stopLoss", "PositionView.takeProfit",
            "ProtectionRequest.stopLoss", "ProtectionRequest.takeProfit",
            "CashTransaction.reference",
            "PriceAlert.note", "PriceAlert.triggeredAt", "PriceAlert.triggeredPrice",
            "CreateAlertRequest.note",
            "UserProfile.email");

    /** Request bodies: their nullable fields may also be omitted. */
    private static final Set<String> REQUESTS = Set.of("PlaceOrderRequest", "ProtectionRequest", "CreateAlertRequest");

    @Bean
    OpenApiCustomizer requiredRecordProperties() {
        return openApi -> openApi.getComponents().getSchemas().forEach((name, schema) -> {
            @SuppressWarnings("unchecked")
            Map<String, Schema<?>> properties = (Map<String, Schema<?>>) (Map<?, ?>) schema.getProperties();
            if (properties == null) {
                return;
            }
            List<String> required = new ArrayList<>();
            properties.forEach((prop, propSchema) -> {
                if (NULLABLE.contains(name + "." + prop)) {
                    Set<String> types = propSchema.getTypes() != null ? propSchema.getTypes()
                            : Set.of(propSchema.getType());
                    var withNull = new LinkedHashSet<>(types);
                    withNull.add("null");
                    propSchema.setTypes(withNull);
                    if (!REQUESTS.contains(name)) {
                        required.add(prop);
                    }
                } else {
                    required.add(prop);
                }
            });
            schema.setRequired(required);
        });
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
