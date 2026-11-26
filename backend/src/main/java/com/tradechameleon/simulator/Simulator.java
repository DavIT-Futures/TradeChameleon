package com.tradechameleon.simulator;

import java.util.concurrent.atomic.AtomicReference;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/** Public API of the simulator module: the current settings, readable from any module. */
@Service
public class Simulator {

    private final AtomicReference<SimulatorSettings> settings = new AtomicReference<>(SimulatorSettings.defaults());
    private final ApplicationEventPublisher events;

    Simulator(ApplicationEventPublisher events) {
        this.events = events;
    }

    public SimulatorSettings settings() {
        return settings.get();
    }

    SimulatorSettings update(SimulatorSettings next) {
        var previous = settings.getAndSet(next);
        events.publishEvent(new SimulatorSettingsChanged(previous, next));
        return next;
    }
}
