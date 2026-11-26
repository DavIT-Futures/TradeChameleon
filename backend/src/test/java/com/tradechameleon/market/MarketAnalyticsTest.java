package com.tradechameleon.market;

import static org.assertj.core.api.Assertions.assertThat;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class MarketAnalyticsTest {

    private static PriceEngine.PricePoint p(long second, String price) {
        return new PriceEngine.PricePoint(Instant.ofEpochSecond(second), new BigDecimal(price));
    }

    @Test
    void aggregatesTicksIntoOhlcCandles() {
        var points = List.of(p(0, "10"), p(1, "12"), p(2, "9"), p(3, "11"), // first 5s bucket
                p(5, "11"), p(7, "13"));                                       // second bucket
        var candles = MarketAnalytics.candles(points, Duration.ofSeconds(5), 10);
        assertThat(candles).hasSize(2);
        var first = candles.getFirst();
        assertThat(first.open()).isEqualByComparingTo("10");
        assertThat(first.high()).isEqualByComparingTo("12");
        assertThat(first.low()).isEqualByComparingTo("9");
        assertThat(first.close()).isEqualByComparingTo("11");
        assertThat(first.ticks()).isEqualTo(4);
        assertThat(candles.get(1).t()).isEqualTo(Instant.ofEpochSecond(5));
    }

    @Test
    void returnsOnlyTheLastCandles() {
        var points = List.of(p(0, "1"), p(5, "2"), p(10, "3"), p(15, "4"));
        assertThat(MarketAnalytics.candles(points, Duration.ofSeconds(5), 2))
                .extracting(Candle::close).containsExactly(new BigDecimal("3"), new BigDecimal("4"));
    }

    @Test
    void depthIsStableWithinTheSameSecond() {
        var instrument = new Instrument("SAP", "SAP SE", AssetClass.STOCK, "XETRA", "EUR", 2, new BigDecimal("236.40"));
        var quote = new Quote("SAP", new BigDecimal("236.30"), new BigDecimal("236.50"), new BigDecimal("236.40"),
                BigDecimal.ZERO, BigDecimal.ZERO, Instant.ofEpochSecond(1_000));
        var a = MarketAnalytics.depth(instrument, quote, 5);
        var b = MarketAnalytics.depth(instrument, quote, 5);
        assertThat(a).isEqualTo(b);
        assertThat(a.bids().getFirst().price()).isEqualByComparingTo("236.30");
        assertThat(a.asks().get(1).price()).isGreaterThan(a.asks().getFirst().price());
    }
}
