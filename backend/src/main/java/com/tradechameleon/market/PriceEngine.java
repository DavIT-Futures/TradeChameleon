package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.simulator.Simulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/**
 * Simulated price engine: a seeded geometric random walk per instrument.
 *
 * <p>Determinism: every instrument has its own {@link Random} seeded from {@code tc.market.seed} and the
 * symbol, so the price path (and therefore the seed data, screenshots and tests) is reproducible.
 * The engine runs on a virtual-thread scheduler and publishes {@link PricesTicked} after every tick.
 */
@Component
class PriceEngine implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(PriceEngine.class);

    /** One-tick standard deviation of returns per asset class. */
    private static final Map<AssetClass, Double> VOLATILITY = Map.of(
            AssetClass.STOCK, 0.0009,
            AssetClass.ETF, 0.0005,
            AssetClass.FX, 0.0002,
            AssetClass.CRYPTO, 0.0022,
            AssetClass.BOND, 0.00015);

    private final Map<String, Series> series = new LinkedHashMap<>();
    private final MarketProperties props;
    private final Simulator simulator;
    private final ApplicationEventPublisher events;
    private ScheduledExecutorService scheduler;
    private volatile boolean running;

    PriceEngine(InstrumentRepository instruments, MarketProperties props, Simulator simulator,
                ApplicationEventPublisher events) {
        this.props = props;
        this.simulator = simulator;
        this.events = events;
        Instant start = Instant.now().minus(props.tickInterval().multipliedBy(props.historySize()));
        for (Instrument instrument : instruments.findAll()) {
            var s = new Series(instrument, new Random(props.seed() ^ instrument.symbol().hashCode()));
            // Pre-fill the history so sparklines and charts have data right after startup.
            for (int i = 0; i < props.historySize(); i++) {
                s.step(1.0, start.plus(props.tickInterval().multipliedBy(i)), props.historySize());
            }
            series.put(instrument.symbol(), s);
        }
    }

    /** Advances every instrument by one tick and publishes the result. Package-private for tests. */
    synchronized PricesTicked tick() {
        double multiplier = simulator.settings().volatilityMultiplier();
        Instant now = Instant.now();
        List<PricesTicked.Tick> ticks = new ArrayList<>(series.size());
        for (Series s : series.values()) {
            ticks.add(new PricesTicked.Tick(s.instrument.symbol(), s.step(multiplier, now, props.historySize())));
        }
        var event = new PricesTicked(now, List.copyOf(ticks));
        events.publishEvent(event);
        return event;
    }

    BigDecimal mid(String symbol) {
        return seriesOf(symbol).mid();
    }

    BigDecimal open(String symbol) {
        return seriesOf(symbol).open;
    }

    Instant lastUpdate(String symbol) {
        return seriesOf(symbol).last().at();
    }

    List<PricePoint> history(String symbol, int points) {
        return seriesOf(symbol).history(points);
    }

    private Series seriesOf(String symbol) {
        Series s = series.get(symbol);
        if (s == null) {
            throw new IllegalArgumentException("Unknown symbol " + symbol);
        }
        return s;
    }

    // ---- lifecycle: start ticking once the context is ready ---------------------------------

    @Override
    public void start() {
        if (!props.autoStart()) {
            running = true;
            return;
        }
        scheduler = Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().name("price-engine").factory());
        long period = props.tickInterval().toMillis();
        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (!simulator.settings().paused()) {
                    tick();
                }
            } catch (RuntimeException e) {
                log.warn("Price tick failed", e);
            }
        }, period, period, TimeUnit.MILLISECONDS);
        running = true;
        log.info("Price engine started: {} instruments, tick every {} ms", series.size(), period);
    }

    @Override
    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    /** One point of price history. */
    record PricePoint(Instant at, BigDecimal price) {
    }

    /** Mutable price path of one instrument; guarded by the engine's lock for writes. */
    private static final class Series {

        private final Instrument instrument;
        private final Random random;
        private final ArrayDeque<PricePoint> history = new ArrayDeque<>();
        private double price;
        private BigDecimal open;

        Series(Instrument instrument, Random random) {
            this.instrument = instrument;
            this.random = random;
            this.price = instrument.basePrice().doubleValue();
        }

        BigDecimal step(double volatilityMultiplier, Instant at, int maxSize) {
            double sigma = VOLATILITY.get(instrument.assetClass()) * volatilityMultiplier;
            // Small mean reversion towards the base price keeps long demo sessions realistic.
            double drift = 0.002 * (instrument.basePrice().doubleValue() - price) / price;
            price = price * Math.exp(drift + sigma * random.nextGaussian());
            BigDecimal rounded = BigDecimal.valueOf(price).setScale(instrument.decimals(), RoundingMode.HALF_UP);
            synchronized (history) {
                if (open == null) {
                    open = rounded;
                }
                history.addLast(new PricePoint(at, rounded));
                while (history.size() > maxSize) {
                    history.removeFirst();
                }
            }
            return rounded;
        }

        BigDecimal mid() {
            return last().price();
        }

        PricePoint last() {
            synchronized (history) {
                return history.getLast();
            }
        }

        List<PricePoint> history(int points) {
            synchronized (history) {
                var all = new ArrayList<>(history);
                int from = Math.max(0, all.size() - points);
                return Collections.unmodifiableList(all.subList(from, all.size()));
            }
        }
    }
}
