package com.tradechameleon;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * Architecture tests: no cycles between modules and no module reaching into another module's internals.
 * Also writes module diagrams (PlantUML / C4) to {@code target/spring-modulith-docs}.
 */
class ModularityTests {

    private final ApplicationModules modules = ApplicationModules.of(TradeChameleonApplication.class);

    @Test
    void modulesRespectTheirBoundaries() {
        modules.verify();
    }

    @Test
    void writesDocumentation() {
        new Documenter(modules).writeDocumentation();
    }
}
