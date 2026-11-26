package com.tradechameleon.simulator;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Backs the developer panel of both front-ends. Global (not per tenant): it simulates the platform. */
@RestController
@RequestMapping("/api/simulator")
@Tag(name = "Simulator", description = "Latency, failure and volatility simulator for the dev panel")
@SecurityRequirement(name = "bearer")
class SimulatorController {

    private final Simulator simulator;

    SimulatorController(Simulator simulator) {
        this.simulator = simulator;
    }

    @GetMapping
    @Operation(summary = "Current simulator settings")
    SimulatorSettings get() {
        return simulator.settings();
    }

    @PutMapping
    @Operation(summary = "Replace simulator settings")
    SimulatorSettings put(@Valid @RequestBody SimulatorSettings settings) {
        return simulator.update(settings);
    }

    @PostMapping("/reset")
    @Operation(summary = "Back to defaults: no latency, no failures, normal volatility")
    SimulatorSettings reset() {
        return simulator.update(SimulatorSettings.defaults());
    }
}
