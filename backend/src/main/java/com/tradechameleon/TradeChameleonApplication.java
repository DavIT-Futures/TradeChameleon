package com.tradechameleon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.modulith.Modulithic;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * TradeChameleon: a multi-tenant, white-label training trading platform.
 *
 * <p>The application is a modular monolith. Each direct sub-package of {@code com.tradechameleon}
 * is a Spring Modulith application module (tenant, identity, market, simulator, trading, portfolio, shared).
 * Modules talk to each other through small public APIs and through application events.
 */
@Modulithic(systemName = "TradeChameleon", sharedModules = "shared")
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableAsync
public class TradeChameleonApplication {

    public static void main(String[] args) {
        SpringApplication.run(TradeChameleonApplication.class, args);
    }
}
