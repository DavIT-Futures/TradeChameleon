package com.tradechameleon.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class StatsAndMarginTest {

    @Test
    void rsiOfAStraightRiseIsHundred() {
        List<BigDecimal> up = new ArrayList<>();
        for (int i = 0; i < 30; i++) up.add(BigDecimal.valueOf(100 + i));
        assertThat(MarketAnalytics.rsi(up, 14)).isEqualTo(100.0);
        assertThat(MarketAnalytics.rsi(up.subList(0, 10), 14)).isNull();
    }

    @Test
    void flatPricesHaveZeroVolatility() {
        List<PriceEngine.PricePoint> flat = new ArrayList<>();
        for (int i = 0; i < 100; i++) flat.add(new PriceEngine.PricePoint(Instant.ofEpochSecond(i), BigDecimal.TEN));
        assertThat(MarketAnalytics.hourlyVolatilityPct(flat, 60)).isCloseTo(0, within(1e-9));
    }

    @Test
    void volatilityScalesWithTheSizeOfMoves() {
        List<PriceEngine.PricePoint> calm = new ArrayList<>();
        List<PriceEngine.PricePoint> wild = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            calm.add(new PriceEngine.PricePoint(Instant.ofEpochSecond(i), BigDecimal.valueOf(100 + (i % 2) * 0.1)));
            wild.add(new PriceEngine.PricePoint(Instant.ofEpochSecond(i), BigDecimal.valueOf(100 + (i % 2) * 1.0)));
        }
        assertThat(MarketAnalytics.hourlyVolatilityPct(wild, 60)).isGreaterThan(MarketAnalytics.hourlyVolatilityPct(calm, 60) * 5);
    }

    @Test
    void sentimentStaysWithinBoundsAndIsContrarian() {
        Instant t = Instant.parse("2026-11-26T12:00:00Z");
        for (double change : new double[] {-20, -2, 0, 2, 20}) {
            assertThat(MarketAnalytics.longPct("AAPL", change, t)).isBetween(10, 90);
        }
        assertThat(MarketAnalytics.longPct("AAPL", -3, t)).isGreaterThan(MarketAnalytics.longPct("AAPL", 3, t));
    }

    @Test
    void marginRatesFollowEsmaStyleLimits() {
        var eurusd = new Instrument("EURUSD", "EUR/USD", AssetClass.FX, "FX", "USD", 5, BigDecimal.ONE);
        var usdpln = new Instrument("USDPLN", "USD/PLN", AssetClass.FX, "FX", "PLN", 4, BigDecimal.ONE);
        var aapl = new Instrument("AAPL", "Apple", AssetClass.STOCK, "NASDAQ", "USD", 2, BigDecimal.TEN);
        var btc = new Instrument("BTCUSD", "Bitcoin", AssetClass.CRYPTO, "CRYPTO", "USD", 2, BigDecimal.TEN);
        assertThat(MarginRules.leverage(eurusd)).isEqualTo(30);
        assertThat(MarginRules.leverage(usdpln)).isEqualTo(20);
        assertThat(MarginRules.leverage(aapl)).isEqualTo(5);
        assertThat(MarginRules.leverage(btc)).isEqualTo(2);
    }
}
