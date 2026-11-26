package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;

/** Calendar, news, screener statistics and the portfolio risk view over real HTTP. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class InsightsIntegrationTests {

    @LocalServerPort
    int port;

    ApiClient api;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
    }

    @Test
    void calendarIsSortedAndFilteredByImportance() {
        var all = api.get("/api/market/calendar?from=2026-11-23&to=2026-11-27", "aurora", null).body();
        assertThat(all.size()).isGreaterThan(5);
        String previous = "";
        for (JsonNode e : all) {
            assertThat(e.get("time").asString()).isGreaterThanOrEqualTo(previous);
            previous = e.get("time").asString();
        }
        var high = api.get("/api/market/calendar?from=2026-11-23&to=2026-11-27&minImportance=3", "aurora", null).body();
        for (JsonNode e : high) {
            assertThat(e.get("importance").asInt()).isEqualTo(3);
        }
        assertThat(high.size()).isLessThan(all.size());
    }

    @Test
    void calendarOnlyLinksInstrumentsTheBrokerOffers() {
        var sakura = api.get("/api/market/calendar?from=2026-11-02&to=2026-11-27", "sakura", null).body();
        for (JsonNode e : sakura) {
            for (JsonNode s : e.get("symbols")) {
                assertThat(s.asString()).isNotIn("EURUSD", "BTCUSD", "XAUUSD", "WTI");
            }
        }
        assertThat(api.get("/api/market/calendar?from=2026-11-27&to=2026-11-01", "aurora", null).status()).isEqualTo(400);
    }

    @Test
    void defaultCalendarRangeCoversToday() {
        var events = api.get("/api/market/calendar", "aurora", null).body();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (JsonNode e : events) {
            LocalDate d = LocalDate.parse(e.get("time").asString().substring(0, 10));
            assertThat(d).isBetween(today.minusDays(2), today.plusDays(5));
        }
    }

    @Test
    void newsCanBeFilteredBySymbolAndRespectsTheBroker() {
        var gold = api.get("/api/market/news?symbol=XAUUSD&limit=50", "aurora", null).body();
        for (JsonNode n : gold) {
            assertThat(n.get("symbol").asString()).isEqualTo("XAUUSD");
            assertThat(n.get("sentiment").asString()).isIn("POSITIVE", "NEUTRAL", "NEGATIVE");
        }
        // Kestrel does not offer commodities: no gold headlines there
        assertThat(api.get("/api/market/news?symbol=XAUUSD", "kestrel", null).body().size()).isZero();
        var feed = api.get("/api/market/news?limit=10", "aurora", null).body();
        assertThat(feed.size()).isLessThanOrEqualTo(10);
    }

    @Test
    void screenerStatsCoverEveryInstrument() {
        int instruments = api.get("/api/market/instruments", "aurora", null).body().size();
        var stats = api.get("/api/market/stats", "aurora", null).body();
        assertThat(stats.size()).isEqualTo(instruments);
        for (JsonNode s : stats) {
            if (!s.get("rsi14").isNull()) {
                assertThat(s.get("rsi14").decimalValue()).isBetween(BigDecimal.ZERO, BigDecimal.valueOf(100));
            }
            assertThat(s.get("rangePct").decimalValue()).isBetween(BigDecimal.ZERO, BigDecimal.valueOf(100));
            assertThat(s.get("longPct").asInt()).isBetween(10, 90);
            assertThat(s.get("volatilityPct").decimalValue()).isGreaterThanOrEqualTo(BigDecimal.ZERO);
        }
    }

    @Test
    void instrumentsCarryMarginRules() {
        var eurusd = api.get("/api/market/instruments/EURUSD", "aurora", null).body();
        assertThat(eurusd.get("leverage").asInt()).isEqualTo(30);
        assertThat(eurusd.get("marginRate").decimalValue()).isEqualByComparingTo("0.0333");
    }

    @Test
    void riskViewIsConsistent() {
        var risk = api.get("/api/portfolio/risk", "kestrel", api.login("kestrel", "viewer")).body();
        BigDecimal exposure = risk.get("exposure").decimalValue();
        BigDecimal margin = risk.get("marginRequired").decimalValue();
        BigDecimal sumMargin = BigDecimal.ZERO;
        for (JsonNode p : risk.get("positions")) {
            sumMargin = sumMargin.add(p.get("margin").decimalValue());
        }
        assertThat(sumMargin.setScale(0, RoundingMode.HALF_UP)).isEqualByComparingTo(margin.setScale(0, RoundingMode.HALF_UP));
        assertThat(risk.get("freeMargin").decimalValue())
                .isEqualByComparingTo(risk.get("equity").decimalValue().subtract(margin));
        assertThat(margin).isLessThan(exposure);
        assertThat(risk.get("marginLevelPct").decimalValue()).isGreaterThan(BigDecimal.valueOf(100));
    }
}
