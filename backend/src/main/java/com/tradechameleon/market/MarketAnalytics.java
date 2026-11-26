package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.springframework.stereotype.Component;

/** Candles and market depth, derived from the price engine. Pure computations, easy to unit-test. */
@Component
class MarketAnalytics {

    static final Map<String, Duration> INTERVALS = Map.of(
            "5s", Duration.ofSeconds(5),
            "15s", Duration.ofSeconds(15),
            "1m", Duration.ofMinutes(1),
            "5m", Duration.ofMinutes(5));

    /** Typical size of one book level per asset class: [min, max, decimals]. */
    private static final Map<AssetClass, double[]> LEVEL_SIZE = Map.of(
            AssetClass.STOCK, new double[] {50, 2500, 0},
            AssetClass.ETF, new double[] {20, 1500, 0},
            AssetClass.FX, new double[] {50_000, 3_000_000, 0},
            AssetClass.CRYPTO, new double[] {0.05, 12, 3},
            AssetClass.BOND, new double[] {10, 400, 0},
            AssetClass.COMMODITY, new double[] {1, 60, 0},
            AssetClass.INDEX, new double[] {1, 80, 0},
            AssetClass.OPTION, new double[] {1, 50, 0});

    /** Groups ticks into OHLC candles of the given interval; returns the last {@code limit} candles. */
    static List<Candle> candles(List<PriceEngine.PricePoint> points, Duration interval, int limit) {
        long size = interval.toMillis();
        List<Candle> result = new ArrayList<>();
        long bucket = Long.MIN_VALUE;
        BigDecimal open = null, high = null, low = null, close = null;
        int ticks = 0;
        for (var p : points) {
            long b = Math.floorDiv(p.at().toEpochMilli(), size) * size;
            if (b != bucket) {
                if (open != null) {
                    result.add(new Candle(Instant.ofEpochMilli(bucket), open, high, low, close, ticks));
                }
                bucket = b;
                open = high = low = close = p.price();
                ticks = 0;
            }
            high = high.max(p.price());
            low = low.min(p.price());
            close = p.price();
            ticks++;
        }
        if (open != null) {
            result.add(new Candle(Instant.ofEpochMilli(bucket), open, high, low, close, ticks));
        }
        return result.size() > limit ? result.subList(result.size() - limit, result.size()) : result;
    }

    /**
     * Synthetic, deterministic-per-second order book: price levels step away from the tenant's bid/ask,
     * sizes are pseudo-random but stable within the same second (seeded by symbol + epoch second).
     */
    static OrderBook depth(Instrument instrument, Quote quote, int levels) {
        int scale = instrument.decimals();
        BigDecimal unit = BigDecimal.ONE.movePointLeft(scale);
        BigDecimal step = quote.mid().multiply(new BigDecimal("0.0002")).setScale(scale, RoundingMode.HALF_UP).max(unit);
        double[] sizes = LEVEL_SIZE.get(instrument.assetClass());
        var random = new Random(instrument.symbol().hashCode() * 31L + quote.timestamp().getEpochSecond());
        List<OrderBook.Level> bids = new ArrayList<>(levels);
        List<OrderBook.Level> asks = new ArrayList<>(levels);
        for (int i = 0; i < levels; i++) {
            BigDecimal offset = step.multiply(BigDecimal.valueOf(i));
            // deeper levels hold more size, like a real book
            double depthFactor = 1 + i * 0.35;
            bids.add(new OrderBook.Level(quote.bid().subtract(offset), size(sizes, random, depthFactor)));
            asks.add(new OrderBook.Level(quote.ask().add(offset), size(sizes, random, depthFactor)));
        }
        return new OrderBook(instrument.symbol(), bids, asks, quote.timestamp());
    }

    private static BigDecimal size(double[] range, Random random, double factor) {
        double value = (range[0] + random.nextDouble() * (range[1] - range[0])) * factor;
        return BigDecimal.valueOf(value).setScale((int) range[2], RoundingMode.HALF_UP);
    }

    // ---- statistics for the screener --------------------------------------------------------

    /** Realised volatility over the last {@code window} ticks, scaled to one hour, in percent. */
    static double hourlyVolatilityPct(List<PriceEngine.PricePoint> points, int window) {
        int from = Math.max(1, points.size() - window);
        int n = points.size() - from;
        if (n < 2) {
            return 0;
        }
        double sum = 0, sumSq = 0;
        for (int i = from; i < points.size(); i++) {
            double r = Math.log(points.get(i).price().doubleValue() / points.get(i - 1).price().doubleValue());
            sum += r;
            sumSq += r * r;
        }
        double mean = sum / n;
        double variance = Math.max(0, sumSq / n - mean * mean);
        long secondsPerTick = Math.max(1, java.time.Duration.between(points.get(from - 1).at(), points.getLast().at()).toSeconds() / n);
        return Math.sqrt(variance * 3600.0 / secondsPerTick) * 100;
    }

    /** Wilder RSI over closing prices; null when there are not enough values. */
    static Double rsi(List<BigDecimal> closes, int period) {
        if (closes.size() <= period) {
            return null;
        }
        double gain = 0, loss = 0;
        for (int i = 1; i <= period; i++) {
            double c = closes.get(i).doubleValue() - closes.get(i - 1).doubleValue();
            if (c >= 0) gain += c; else loss -= c;
        }
        gain /= period;
        loss /= period;
        for (int i = period + 1; i < closes.size(); i++) {
            double c = closes.get(i).doubleValue() - closes.get(i - 1).doubleValue();
            gain = (gain * (period - 1) + Math.max(c, 0)) / period;
            loss = (loss * (period - 1) + Math.max(-c, 0)) / period;
        }
        return loss == 0 ? 100.0 : 100 - 100 / (1 + gain / loss);
    }

    /**
     * Simulated client sentiment: retail crowds tend to be contrarian (they buy dips), so the long share
     * rises when the price falls. A small hourly, seeded wiggle keeps it from looking mechanical.
     */
    static int longPct(String symbol, double changePct, Instant now) {
        var random = new Random(symbol.hashCode() * 17L + now.getEpochSecond() / 3600);
        double value = 50 - changePct * 6 + (random.nextDouble() - 0.5) * 16;
        return (int) Math.round(Math.max(10, Math.min(90, value)));
    }

    List<InstrumentStats> stats(Tenant tenant) {
        List<InstrumentStats> result = new ArrayList<>();
        for (Instrument i : market.instruments(tenant)) {
            var history = market.history(i.symbol(), Integer.MAX_VALUE);
            Quote q = market.quote(i, tenant);
            var closes = candles(history, Duration.ofMinutes(1), 120).stream().map(Candle::close).toList();
            BigDecimal high = history.stream().map(PriceEngine.PricePoint::price).max(BigDecimal::compareTo).orElse(q.mid());
            BigDecimal low = history.stream().map(PriceEngine.PricePoint::price).min(BigDecimal::compareTo).orElse(q.mid());
            double range = high.subtract(low).doubleValue();
            double position = range == 0 ? 50 : q.mid().subtract(low).doubleValue() / range * 100;
            Double rsi = rsi(closes, 14);
            result.add(new InstrumentStats(i.symbol(), i.name(), i.assetClass(), i.category(), i.decimals(), q.mid(),
                    q.changePct(),
                    BigDecimal.valueOf(hourlyVolatilityPct(history, 600)).setScale(2, RoundingMode.HALF_UP),
                    rsi == null ? null : BigDecimal.valueOf(rsi).setScale(1, RoundingMode.HALF_UP),
                    high, low,
                    BigDecimal.valueOf(position).setScale(1, RoundingMode.HALF_UP),
                    q.ask().subtract(q.bid()).multiply(BigDecimal.valueOf(10_000))
                            .divide(q.mid(), 1, RoundingMode.HALF_UP),
                    longPct(i.symbol(), q.changePct().doubleValue(), q.timestamp())));
        }
        return result;
    }

    // ---- bean API used by the controller ----------------------------------------------------

    private final MarketData market;

    MarketAnalytics(MarketData market) {
        this.market = market;
    }

    List<Candle> candles(String symbol, Duration interval, int limit) {
        return candles(market.history(symbol, Integer.MAX_VALUE), interval, limit);
    }

    OrderBook depth(Instrument instrument, Tenant tenant, int levels) {
        return depth(instrument, market.quote(instrument, tenant), levels);
    }
}
