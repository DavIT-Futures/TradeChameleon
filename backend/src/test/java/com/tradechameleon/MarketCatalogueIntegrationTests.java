package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;

/** Market browsing by asset class, contract details and option chains, per broker. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class MarketCatalogueIntegrationTests {

    @LocalServerPort
    int port;

    ApiClient api;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
    }

    private Set<String> classes(String tenant) {
        var set = new HashSet<String>();
        for (JsonNode i : api.get("/api/market/instruments", tenant, null).body()) {
            set.add(i.get("assetClass").asString());
        }
        return set;
    }

    @Test
    void catalogueRespectsEachBrokersAssetClasses() {
        assertThat(classes("aurora")).containsExactlyInAnyOrder("STOCK", "ETF", "FX", "CRYPTO", "COMMODITY", "INDEX");
        assertThat(classes("kestrel")).containsExactlyInAnyOrder("STOCK", "ETF", "CRYPTO", "INDEX");
        assertThat(classes("wisla")).contains("COMMODITY", "BOND", "FX").doesNotContain("CRYPTO");
        assertThat(api.get("/api/market/instruments/XAUUSD", "kestrel", null).status()).isEqualTo(404);
    }

    @Test
    void instrumentsCarryContractDetails() {
        var gold = api.get("/api/market/instruments/XAUUSD", "aurora", null).body();
        assertThat(gold.get("category").asString()).isEqualTo("Metals");
        assertThat(gold.get("unit").asString()).isEqualTo("troy oz");
        assertThat(gold.get("contractSize").decimalValue()).isEqualByComparingTo("100");
        assertThat(gold.get("optionChain").asBoolean()).isTrue();

        var usdjpy = api.get("/api/market/instruments/USDJPY", "aurora", null).body();
        assertThat(usdjpy.get("pipSize").decimalValue()).isEqualByComparingTo("0.01");
        assertThat(usdjpy.get("category").asString()).isEqualTo("Majors");
    }

    @Test
    void overviewSummarisesEveryOfferedClass() {
        var overview = api.get("/api/market/overview", "aurora", null).body();
        var seen = new HashSet<String>();
        for (JsonNode c : overview) {
            seen.add(c.get("assetClass").asString());
            if (!c.get("assetClass").asString().equals("OPTION")) {
                assertThat(c.get("gainers").asInt() + c.get("losers").asInt()).isLessThanOrEqualTo(c.get("instruments").asInt());
                assertThat(c.get("best").get("changePct").decimalValue())
                        .isGreaterThanOrEqualTo(c.get("worst").get("changePct").decimalValue());
            }
        }
        assertThat(seen).contains("STOCK", "COMMODITY", "INDEX", "OPTION");
        // Wisła does not offer options: no OPTION card
        assertThat(api.get("/api/market/overview", "wisla", null).body().toString()).doesNotContain("\"OPTION\"");
    }

    @Test
    void optionChainIsPricedAroundTheMoney() {
        var chain = api.get("/api/market/instruments/AAPL/options", "aurora", null).body();
        assertThat(chain.get("expiries").size()).isEqualTo(4);
        assertThat(chain.get("expiry").asString()).isEqualTo(chain.get("expiries").get(1).asString());
        var rows = chain.get("rows");
        assertThat(rows.size()).isEqualTo(11);
        BigDecimal previousCallDelta = BigDecimal.TEN;
        for (JsonNode row : rows) {
            BigDecimal callDelta = row.get("call").get("delta").decimalValue();
            assertThat(callDelta).isLessThanOrEqualTo(previousCallDelta); // deeper OTM calls have lower delta
            assertThat(row.get("call").get("ask").decimalValue()).isGreaterThan(row.get("call").get("bid").decimalValue());
            previousCallDelta = callDelta;
        }
        String last = chain.get("expiries").get(3).asString();
        assertThat(api.get("/api/market/instruments/AAPL/options?expiry=" + last, "aurora", null).body()
                .get("daysToExpiry").asInt()).isGreaterThan(chain.get("daysToExpiry").asInt());
    }

    @Test
    void optionChainRules() {
        var notOffered = api.get("/api/market/instruments/SPY/options", "wisla", null);
        assertThat(notOffered.status()).isEqualTo(403);
        assertThat(notOffered.body().get("type").asString()).endsWith("/options-disabled");
        assertThat(api.get("/api/market/instruments/EURUSD/options", "aurora", null).status()).isEqualTo(404);
        assertThat(api.get("/api/market/instruments/AAPL/options?expiry=2000-01-07", "aurora", null).status()).isEqualTo(400);
    }

    @Test
    void newClassesCanBeTraded() {
        String token = api.login("aurora", "trader");
        var body = new java.util.HashMap<String, Object>();
        body.put("symbol", "XAUUSD");
        body.put("side", "BUY");
        body.put("type", "MARKET");
        body.put("quantity", new BigDecimal("1"));
        var r = api.post("/api/orders", "aurora", token, body);
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.body().get("status").asString()).isEqualTo("FILLED");
    }
}
