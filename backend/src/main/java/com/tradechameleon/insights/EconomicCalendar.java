package com.tradechameleon.insights;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Simulated economic calendar. Each day's events are generated from a fixed catalogue with a random
 * generator seeded by the date, so every user (and every test) sees the same calendar for the same day.
 * Events in the past get an "actual" value; future ones only have forecast and previous.
 */
@Service
class EconomicCalendar {

    /** A kind of release: who publishes it, how important it is, its unit and typical value/noise. */
    record Template(String country, String currency, String title, int importance, String unit, double typical,
                    double noise, int hourUtc, Set<String> symbols) {
    }

    static final List<Template> CATALOGUE = List.of(
            new Template("US", "USD", "Non-Farm Payrolls", 3, "K", 180, 60, 13, Set.of("EURUSD", "GBPUSD", "USDJPY", "SPX500", "NDX100", "XAUUSD")),
            new Template("US", "USD", "CPI y/y", 3, "%", 2.9, 0.2, 13, Set.of("EURUSD", "USDJPY", "SPX500", "NDX100", "XAUUSD", "BTCUSD")),
            new Template("US", "USD", "Fed Interest Rate Decision", 3, "%", 4.50, 0.0, 19, Set.of("EURUSD", "USDJPY", "SPX500", "NDX100", "XAUUSD", "SPY")),
            new Template("US", "USD", "Retail Sales m/m", 2, "%", 0.3, 0.3, 13, Set.of("EURUSD", "SPX500", "AAPL")),
            new Template("US", "USD", "ISM Manufacturing PMI", 2, "", 48.5, 1.2, 15, Set.of("SPX500", "HG", "EURUSD")),
            new Template("US", "USD", "Crude Oil Inventories", 2, "M", -1.2, 3.0, 15, Set.of("WTI", "BRENT")),
            new Template("US", "USD", "Initial Jobless Claims", 1, "K", 220, 12, 13, Set.of("EURUSD", "SPX500")),
            new Template("EU", "EUR", "ECB Interest Rate Decision", 3, "%", 3.15, 0.0, 13, Set.of("EURUSD", "EURGBP", "EURPLN", "DAX40")),
            new Template("EU", "EUR", "HICP Inflation y/y", 2, "%", 2.3, 0.2, 10, Set.of("EURUSD", "EURGBP", "DAX40", "DE10Y")),
            new Template("DE", "EUR", "Ifo Business Climate", 2, "", 85.7, 1.0, 9, Set.of("DAX40", "SAP", "EURUSD")),
            new Template("DE", "EUR", "GDP q/q", 2, "%", 0.1, 0.2, 7, Set.of("DAX40", "EURUSD", "DE10Y")),
            new Template("GB", "GBP", "BoE Interest Rate Decision", 3, "%", 4.75, 0.0, 12, Set.of("GBPUSD", "EURGBP", "FTSE100")),
            new Template("GB", "GBP", "CPI y/y", 2, "%", 2.3, 0.2, 7, Set.of("GBPUSD", "EURGBP", "FTSE100")),
            new Template("PL", "PLN", "NBP Interest Rate Decision", 3, "%", 5.75, 0.0, 13, Set.of("USDPLN", "EURPLN", "WIG20", "PKO", "PL10Y")),
            new Template("PL", "PLN", "CPI y/y", 2, "%", 4.6, 0.3, 9, Set.of("USDPLN", "EURPLN", "WIG20", "PL10Y")),
            new Template("JP", "JPY", "BoJ Interest Rate Decision", 3, "%", 0.25, 0.0, 3, Set.of("USDJPY", "NI225", "7203", "JGB10Y")),
            new Template("JP", "JPY", "Tankan Large Manufacturers", 2, "", 13, 2, 0, Set.of("USDJPY", "NI225", "7203")),
            new Template("CN", "CNY", "Caixin Manufacturing PMI", 2, "", 50.3, 0.8, 1, Set.of("HG", "AUDUSD", "XAUUSD")),
            new Template("AU", "AUD", "RBA Interest Rate Decision", 2, "%", 4.35, 0.0, 3, Set.of("AUDUSD")));

    private final MarketData market;
    private final Clock clock;

    @Autowired
    EconomicCalendar(MarketData market) {
        this(market, Clock.systemUTC());
    }

    EconomicCalendar(MarketData market, Clock clock) {
        this.market = market;
        this.clock = clock;
    }

    /** Events between two dates (inclusive), at least the given importance, sorted by time. */
    List<EconomicEvent> events(Tenant tenant, LocalDate from, LocalDate to, int minImportance) {
        Set<String> offered = market.instruments(tenant).stream().map(i -> i.symbol()).collect(Collectors.toSet());
        Instant now = clock.instant();
        List<EconomicEvent> result = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            for (EconomicEvent e : day(day, now)) {
                if (e.importance() >= minImportance) {
                    result.add(new EconomicEvent(e.id(), e.time(), e.country(), e.currency(), e.title(), e.importance(),
                            e.unit(), e.forecast(), e.previous(), e.actual(), e.surprise(),
                            e.symbols().stream().filter(offered::contains).sorted().toList()));
                }
            }
        }
        result.sort(Comparator.comparing(EconomicEvent::time));
        return result;
    }

    /** All events of one day, deterministic for the date; weekends are quiet. */
    static List<EconomicEvent> day(LocalDate day, Instant now) {
        var dow = day.getDayOfWeek().getValue();
        if (dow >= 6) {
            return List.of();
        }
        var random = new Random(day.toEpochDay() * 7919L);
        int count = 4 + random.nextInt(4);
        // pick distinct templates for the day; rate decisions are rarer than data releases
        List<Template> pool = new ArrayList<>(CATALOGUE);
        List<EconomicEvent> events = new ArrayList<>();
        for (int n = 0; n < count && !pool.isEmpty(); n++) {
            Template t = pool.remove(random.nextInt(pool.size()));
            if (t.title().contains("Decision") && random.nextInt(3) != 0) {
                continue;
            }
            int minute = random.nextInt(4) * 15;
            Instant time = day.atTime(t.hourUtc(), minute).toInstant(ZoneOffset.UTC);
            double previous = t.typical() + (random.nextDouble() - 0.5) * 2 * t.noise();
            double forecast = t.noise() == 0 ? t.typical() : t.typical() + (random.nextDouble() - 0.5) * 2 * t.noise();
            double actualValue = t.noise() == 0 ? forecast : forecast + random.nextGaussian() * t.noise() * 0.6;
            boolean released = !time.isAfter(now);
            String surprise = null;
            if (released) {
                double diff = actualValue - forecast;
                surprise = Math.abs(diff) < t.noise() * 0.1 || t.noise() == 0 ? "IN_LINE" : diff > 0 ? "ABOVE" : "BELOW";
            }
            int scale = t.unit().equals("K") || t.typical() >= 100 ? 0 : 2;
            events.add(new EconomicEvent(day + "-" + t.country() + "-" + t.title().replace(' ', '-'),
                    time, t.country(), t.currency(), t.title(), t.importance(), t.unit(),
                    bd(forecast, scale), bd(previous, scale), released ? bd(actualValue, scale) : null, surprise,
                    List.copyOf(t.symbols())));
        }
        return events;
    }

    private static BigDecimal bd(double v, int scale) {
        return BigDecimal.valueOf(v).setScale(scale, RoundingMode.HALF_UP);
    }
}
