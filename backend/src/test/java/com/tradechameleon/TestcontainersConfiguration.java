package com.tradechameleon;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Starts a throw-away PostgreSQL 18 in Docker for the test run. {@link ServiceConnection} wires its
 * JDBC URL, user and password into the DataSource, so no test properties are needed.
 *
 * <p>Escape hatch for machines without Docker: run with {@code -Dtc.test.external-db=true} and point
 * {@code spring.datasource.*} at an empty database.
 */
@TestConfiguration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "tc.test.external-db", havingValue = "false", matchIfMissing = true)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
    }
}
