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
