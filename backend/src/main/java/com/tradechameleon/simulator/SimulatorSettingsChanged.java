package com.tradechameleon.simulator;

/** Published whenever the developer panel changes the simulator. */
public record SimulatorSettingsChanged(SimulatorSettings previous, SimulatorSettings current) {
}
