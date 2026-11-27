package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;

/** Brokers differ in features and limits, not only in looks; the admin panel compares them. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class BrokerProfilesIntegrationTests {

    @LocalServerPort
    int port;

    ApiClient api;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
    }

    private static Map<String, Object> order(String symbol, String side, String type, String qty, String limit) {
        var m = new HashMap<String, Object>();
        m.put("symbol", symbol);
        m.put("side", side);
        m.put("type", type);
        m.put("quantity", new BigDecimal(qty));
        m.put("limitPrice", limit == null ? null : new BigDecimal(limit));
        return m;
    }

    @Test
    void newBrokersHaveTheirOwnBrandingAndCatalogue() {
        var pulse = api.get("/api/tenants/pulse", null, null).body();
        assertThat(pulse.get("currency").asString()).isEqualTo("USD");
        assertThat(pulse.get("theme").get("colorScheme").asString()).isEqualTo("dark");
        assertThat(api.get("/api/tenants/alpenrose/logo.svg", null, null).raw()).contains("<svg").contains("Alpenrose");
        assertThat(api.get("/api/market/instruments/BTCUSD", "alpenrose", null).status()).isEqualTo(404);
        assertThat(api.get("/api/market/instruments/BTCUSD", "pulse", null).status()).isEqualTo(200);
    }

    @Test
    void disabledFeaturesAreForbiddenOnTheServer() {
        for (String path : new String[] {"/api/market/calendar", "/api/market/stats"}) {
            var r = api.get(path, "pulse", null);
            assertThat(r.status()).as(path).isEqualTo(403);
            assertThat(r.body().get("type").asString()).endsWith("/feature-disabled");
        }
        assertThat(api.get("/api/market/news", "pulse", null).status()).isEqualTo(200);
        assertThat(api.get("/api/portfolio/risk", "pulse", api.login("pulse", "trader")).status()).isEqualTo(403);
        assertThat(api.get("/api/alerts", "sakura", api.login("sakura", "trader")).status()).isEqualTo(403);
        assertThat(api.get("/api/alerts", "pulse", api.login("pulse", "trader")).status()).isEqualTo(200);
    }

    @Test
    void pulseAllowsOnlySmallMarketOrders() {
        String token = api.login("pulse", "trader");
        var big = api.post("/api/orders", "pulse", token, order("NVDA", "BUY", "MARKET", "50", null));
        assertThat(big.status()).isEqualTo(422);
        assertThat(big.body().get("type").asString()).endsWith("/order-limit-exceeded");
        assertThat(big.body().get("currency").asString()).isEqualTo("USD");

        var limit = api.post("/api/orders", "pulse", token, order("NVDA", "BUY", "LIMIT", "1", "100"));
        assertThat(limit.status()).isEqualTo(403);

        var small = api.post("/api/orders", "pulse", token, order("NVDA", "BUY", "MARKET", "1", null));
        assertThat(small.status()).isEqualTo(201);
    }

    @Test
    void alpenroseLimitsOrderValueAndPendingOrders() {
        String token = api.login("alpenrose", "trader");
        var tooBig = api.post("/api/orders", "alpenrose", token, order("SAP", "BUY", "MARKET", "300", null));
        assertThat(tooBig.status()).isEqualTo(422);
        assertThat(tooBig.body().get("type").asString()).endsWith("/order-limit-exceeded");

        var ids = new ArrayList<String>();
        for (int i = 0; i < 5; i++) {
            var r = api.post("/api/orders", "alpenrose", token, order("SAP", "BUY", "LIMIT", "1", "1"));
            assertThat(r.status()).isEqualTo(201);
            ids.add(r.body().get("id").asString());
        }
        var sixth = api.post("/api/orders", "alpenrose", token, order("SAP", "BUY", "LIMIT", "1", "1"));
        assertThat(sixth.status()).isEqualTo(422);
        assertThat(sixth.body().get("type").asString()).endsWith("/open-orders-limit");
        ids.forEach(id -> api.delete("/api/orders/" + id, "alpenrose", token));
    }

    @Test
    void adminPanelComparesAllBrokers() {
        assertThat(api.get("/api/platform/tenants", "aurora", api.login("aurora", "trader")).status()).isEqualTo(403);
        assertThat(api.get("/api/platform/tenants", "aurora", null).status()).isEqualTo(401);

        var brokers = api.get("/api/platform/tenants", "aurora", api.platformLogin()).body();
        assertThat(brokers.size()).isEqualTo(6);
        JsonNode pulse = null;
        for (JsonNode b : brokers) {
            if (b.get("id").asString().equals("pulse")) pulse = b;
            assertThat(b.get("instruments").asInt()).isPositive();
        }
        assertThat(pulse).isNotNull();
        assertThat(pulse.get("features").get("screener").asBoolean()).isFalse();
        assertThat(pulse.get("limits").get("maxOrderValue").decimalValue()).isEqualByComparingTo("2000");
        assertThat(pulse.get("users").asInt()).isEqualTo(3);
        assertThat(pulse.get("maintainers").asInt()).isEqualTo(1);
        assertThat(pulse.get("optionChains").asInt()).isZero();
    }
}
