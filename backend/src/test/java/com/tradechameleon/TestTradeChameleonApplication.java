package com.tradechameleon;

import org.springframework.boot.SpringApplication;

/**
 * Runs the application against a Testcontainers PostgreSQL instead of compose.yaml:
 * {@code ./mvnw spring-boot:test-run}.
 */
public class TestTradeChameleonApplication {

    public static void main(String[] args) {
        SpringApplication.from(TradeChameleonApplication::main).with(TestcontainersConfiguration.class).run(args);
    }
}
