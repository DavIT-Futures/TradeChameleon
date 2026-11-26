package com.tradechameleon.insights;

import static org.assertj.core.api.Assertions.assertThat;

import com.tradechameleon.market.Instrument;
import com.tradechameleon.shared.AssetClass;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** Calendar and news generators are pure and deterministic: same inputs, same output. */
class InsightsUnitTest {

    private static final LocalDate THURSDAY = LocalDate.of(2026, 11, 26);

    @Test
    void sameDayAlwaysProducesTheSameCalendar() {
        Instant now = THURSDAY.atTime(12, 0).toInstant(ZoneOffset.UTC);
        assertThat(EconomicCalendar.day(THURSDAY, now)).isEqualTo(EconomicCalendar.day(THURSDAY, now)).isNotEmpty();
    }

    @Test
    void weekendsAreQuiet() {
        Instant now = THURSDAY.atStartOfDay().toInstant(ZoneOffset.UTC);
        assertThat(EconomicCalendar.day(LocalDate.of(2026, 11, 28), now)).isEmpty();
        assertThat(EconomicCalendar.day(LocalDate.of(2026, 11, 29), now)).isEmpty();
    }

    @Test
    void onlyReleasedEventsHaveAnActualValue() {
        Instant noon = THURSDAY.atTime(12, 0).toInstant(ZoneOffset.UTC);
        for (var e : EconomicCalendar.day(THURSDAY, noon)) {
            if (e.time().isAfter(noon)) {
                assertThat(e.actual()).isNull();
                assertThat(e.surprise()).isNull();
            } else {
                assertThat(e.actual()).isNotNull();
                assertThat(e.surprise()).isIn("ABOVE", "BELOW", "IN_LINE");
            }
            assertThat(e.importance()).isBetween(1, 3);
        }
    }

    @Test
    void newsIsDeterministicAndFromTheLastDay() {
        var gold = new Instrument("XAUUSD", "Gold", AssetClass.COMMODITY, "COMEX", "USD", 2, new BigDecimal("2650"));
        Instant now = Instant.parse("2026-11-26T12:34:00Z");
        var a = NewsWire.forInstrument(gold, now);
        assertThat(a).isEqualTo(NewsWire.forInstrument(gold, now));
        assertThat(a).allSatisfy(n -> {
            assertThat(n.time()).isBefore(now.plusSeconds(1)).isAfter(now.minus(Duration.ofHours(25)));
            assertThat(n.headline()).doesNotContain("{");
            assertThat(n.symbol()).isEqualTo("XAUUSD");
        });
    }
}
