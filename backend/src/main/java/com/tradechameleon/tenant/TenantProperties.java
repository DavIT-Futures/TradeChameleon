package com.tradechameleon.tenant;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code tc.tenants.*} settings. */
@ConfigurationProperties("tc.tenants")
public record TenantProperties(String defaultTenant) {

    public TenantProperties {
        if (defaultTenant == null || defaultTenant.isBlank()) {
            defaultTenant = "aurora";
        }
    }
}
