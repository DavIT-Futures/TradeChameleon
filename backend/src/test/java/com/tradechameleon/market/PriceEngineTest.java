package com.tradechameleon.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.simulator.Simulator;
import com.tradechameleon.simulator.SimulatorSettings;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

/** Plain unit test: no Spring context, no database. */
class PriceEngineTest {

    private static final List<Instrument> INSTRUMENTS = List.of(
            new Instrument("AAPL", "Apple", AssetClass.STOCK, "NASDAQ", "USD", 2, new BigDecimal("228.50")),
            new Instrument("BTCUSD", "Bitcoin", AssetClass.CRYPTO, "CRYPTO", "USD", 2, new BigDecimal("97250")));

    private final List<Object> published = new ArrayList<>();

    private PriceEngine engine(long seed, double volatility) {
        InstrumentRepository repo = mock(InstrumentRepository.class);
        when(repo.findAll()).thenReturn(INSTRUMENTS);
        Simulator simulator = mock(Simulator.class);
        when(simulator.settings()).thenReturn(new SimulatorSettings(0, 0, 0, volatility, false));
        ApplicationEventPublisher events = published::add;
        return new PriceEngine(repo, new MarketProperties(seed, Duration.ofSeconds(1), 50, false), simulator, events);
    }

    @Test
    void sameSeedProducesSamePricePath() {
        var a = engine(42, 1.0);
        var b = engine(42, 1.0);
        for (int i = 0; i < 10; i++) {
            assertThat(a.tick().ticks()).isEqualTo(b.tick().ticks());
        }
    }

    @Test
    void differentSeedProducesDifferentPath() {
        assertThat(engine(1, 1.0).mid("AAPL")).isNotEqualByComparingTo(engine(2, 1.0).mid("AAPL"));
    }

    @Test
    void historyIsPrefilledAndBounded() {
        var engine = engine(7, 1.0);
        assertThat(engine.history("AAPL", 1000)).hasSize(50);
        engine.tick();
        assertThat(engine.history("AAPL", 1000)).hasSize(50);
        assertThat(engine.history("AAPL", 10)).hasSize(10);
    }

    @Test
    void zeroVolatilityKeepsPriceNearlyFlat() {
        var engine = engine(7, 0.0);
        BigDecimal before = engine.mid("BTCUSD");
        engine.tick();
        // only the tiny mean-reversion drift remains
        assertThat(engine.mid("BTCUSD").subtract(before).abs()).isLessThan(new BigDecimal("50"));
    }

    @Test
    void publishesOneEventPerTick() {
        var engine = engine(7, 1.0);
        engine.tick();
        engine.tick();
        assertThat(published).hasSize(2).allMatch(PricesTicked.class::isInstance);
    }
}
