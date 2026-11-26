package com.tradechameleon.simulator;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Knobs of the market and network simulator, changed at runtime from the developer panel.
 *
 * @param latencyMs            fixed delay added to every API call (ms)
 * @param jitterMs             extra random delay 0..jitter (ms)
 * @param failureRate          probability 0..1 that an API call fails with 503
 * @param volatilityMultiplier scales price moves (1 = normal, 5 = wild market)
 * @param paused               freezes the price engine
 */
public record SimulatorSettings(
        @Min(0) @Max(10_000) int latencyMs,
        @Min(0) @Max(10_000) int jitterMs,
        @DecimalMin("0.0") @DecimalMax("1.0") double failureRate,
        @DecimalMin("0.0") @DecimalMax("20.0") double volatilityMultiplier,
        boolean paused) {

    public static SimulatorSettings defaults() {
        return new SimulatorSettings(0, 0, 0.0, 1.0, false);
    }
}
