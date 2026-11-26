package com.tradechameleon.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.tradechameleon.shared.AssetClass;
import java.time.DayOfWeek;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class OptionPricerTest {

    @Test
    void normalCdfIsAccurate() {
        assertThat(OptionPricer.cdf(0)).isCloseTo(0.5, within(1e-7));
        assertThat(OptionPricer.cdf(1.96)).isCloseTo(0.9750, within(1e-4));
        assertThat(OptionPricer.cdf(-1.96)).isCloseTo(0.0250, within(1e-4));
    }

    @Test
    void putCallParityHolds() {
        double s = 100, k = 105, t = 0.25, r = 0.03, sigma = 0.3;
        double call = OptionPricer.call(s, k, t, r, sigma).price();
        double put = OptionPricer.put(s, k, t, r, sigma).price();
        // C − P = S − K·e^(−rT)
        assertThat(call - put).isCloseTo(s - k * Math.exp(-r * t), within(1e-6));
    }

    @Test
    void knownValueForAtTheMoneyCall() {
        // S = K = 100, T = 1, r = 5%, σ = 20%: textbook value 10.4506
        assertThat(OptionPricer.call(100, 100, 1, 0.05, 0.2).price()).isCloseTo(10.4506, within(1e-3));
    }

    @Test
    void greeksHaveTheExpectedSigns() {
        var call = OptionPricer.call(100, 100, 0.5, 0.03, 0.25);
        var put = OptionPricer.put(100, 100, 0.5, 0.03, 0.25);
        assertThat(call.delta()).isBetween(0.5, 1.0);
        assertThat(put.delta()).isBetween(-0.5, 0.0);
        assertThat(call.delta() - put.delta()).isCloseTo(1.0, within(1e-9));
        assertThat(call.gamma()).isPositive().isEqualTo(put.gamma());
        assertThat(call.vega()).isPositive().isEqualTo(put.vega());
        assertThat(call.theta()).isNegative();
    }

    @Test
    void expiriesAreAscendingFridays() {
        var expiries = OptionChains.expiries(LocalDate.of(2026, 11, 26));
        assertThat(expiries).hasSize(4).isSorted();
        assertThat(expiries).allMatch(d -> d.getDayOfWeek() == DayOfWeek.FRIDAY);
        assertThat(expiries.getFirst()).isEqualTo(LocalDate.of(2026, 12, 4));
    }

    @Test
    void strikeStepsAreRound() {
        assertThat(OptionChains.niceStep(5.7)).isEqualTo(10);
        assertThat(OptionChains.niceStep(1.3)).isEqualTo(2);
        assertThat(OptionChains.niceStep(0.04)).isCloseTo(0.05, within(1e-12));
    }

    @Test
    void smileMakesWingsMoreExpensive() {
        double atm = OptionChains.impliedVol(AssetClass.STOCK, 100, 100, 30);
        assertThat(OptionChains.impliedVol(AssetClass.STOCK, 100, 80, 30)).isGreaterThan(atm);
        assertThat(OptionChains.impliedVol(AssetClass.STOCK, 100, 120, 30)).isGreaterThan(atm);
        assertThat(atm).isCloseTo(0.30, within(1e-9));
    }
}
