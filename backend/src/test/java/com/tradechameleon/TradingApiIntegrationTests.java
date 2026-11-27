package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;

/**
 * End-to-end tests over real HTTP against PostgreSQL in a Testcontainer. Flyway applies the same
 * migrations and deterministic seed data as in development.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class TradingApiIntegrationTests {

    @LocalServerPort
    int port;

    ApiClient api;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
        // make sure no other test left the simulator in chaos mode
        api.post("/api/simulator/reset", "aurora", api.login("aurora", "trader"), Map.of());
    }

    @Nested
    class Tenants {

        @Test
        void listsAllBrokers() {
            var r = api.get("/api/tenants", null, null);
            assertThat(r.status()).isEqualTo(200);
            assertThat(r.body().size()).isEqualTo(6);
        }

        @Test
        void resolvesFromHeaderQueryParameterAndDefault() {
            assertThat(api.get("/api/tenants/current", "kestrel", null).body().get("id").asString()).isEqualTo("kestrel");
            assertThat(api.get("/api/tenants/current?tenant=wisla", null, null).body().get("id").asString()).isEqualTo("wisla");
            assertThat(api.get("/api/tenants/current", null, null).body().get("id").asString()).isEqualTo("aurora");
        }

        @Test
        void unknownTenantIsAProblem() {
            var r = api.get("/api/tenants/current?tenant=nope", null, null);
            assertThat(r.status()).isEqualTo(400);
            assertThat(r.contentType()).startsWith("application/problem+json");
            assertThat(r.body().get("type").asString()).endsWith("/unknown-tenant");
        }

        @Test
        void logoIsGeneratedSvg() {
            var r = api.get("/api/tenants/kestrel/logo.svg", null, null);
            assertThat(r.status()).isEqualTo(200);
            assertThat(r.contentType()).startsWith("image/svg+xml");
            assertThat(r.raw()).contains("<svg").contains("Kestrel Trade");
        }

        @Test
        void instrumentsAreFilteredByAllowedAssetClasses() {
            var kestrel = api.get("/api/market/instruments", "kestrel", null).body();
            for (JsonNode i : kestrel) {
                assertThat(i.get("assetClass").asString()).isIn("STOCK", "ETF", "CRYPTO", "INDEX");
            }
            assertThat(api.get("/api/market/instruments/PL10Y", "kestrel", null).status()).isEqualTo(404);
        }

        @Test
        void spreadMarkupDiffersPerTenant() {
            var sakura = api.get("/api/market/instruments/VWCE", "sakura", null).body().get("quote");
            var kestrel = api.get("/api/market/instruments/VWCE", "kestrel", null).body().get("quote");
            BigDecimal sakuraSpread = sakura.get("ask").decimalValue().subtract(sakura.get("bid").decimalValue());
            BigDecimal kestrelSpread = kestrel.get("ask").decimalValue().subtract(kestrel.get("bid").decimalValue());
            assertThat(kestrelSpread).isGreaterThan(sakuraSpread);
        }
    }

    @Nested
    class Security {

        @Test
        void issuesRs256TokenAndPublishesJwks() {
            var r = api.post("/api/auth/token", "aurora", null, Map.of("username", "trader@aurora.test", "password", "demo"));
            assertThat(r.status()).isEqualTo(200);
            String token = r.body().get("accessToken").asString();
            String header = new String(java.util.Base64.getUrlDecoder().decode(token.split("\\.")[0]), StandardCharsets.UTF_8);
            assertThat(header).contains("\"alg\":\"RS256\"");
            var jwks = api.get("/oauth2/jwks", null, null);
            assertThat(jwks.body().get("keys").get(0).get("kty").asString()).isEqualTo("RSA");
            assertThat(jwks.raw()).doesNotContain("\"d\""); // never leak the private exponent
        }

        @Test
        void staleTokensAreIgnoredOnPublicEndpointsButRejectedOnProtectedOnes() {
            assertThat(api.get("/api/tenants/current", "aurora", "stale.token.value").status()).isEqualTo(200);
            assertThat(api.get("/api/market/instruments", "aurora", "stale.token.value").status()).isEqualTo(200);
            assertThat(api.get("/api/portfolio", "aurora", "stale.token.value").status()).isEqualTo(401);
        }

        @Test
        void wrongPasswordIs401Problem() {
            var r = api.post("/api/auth/token", "aurora", null, Map.of("username", "trader@aurora.test", "password", "nope"));
            assertThat(r.status()).isEqualTo(401);
            assertThat(r.body().get("type").asString()).endsWith("/invalid-credentials");
        }

        @Test
        void protectedEndpointWithoutTokenIs401Problem() {
            var r = api.get("/api/portfolio", "aurora", null);
            assertThat(r.status()).isEqualTo(401);
            assertThat(r.contentType()).startsWith("application/problem+json");
        }

        @Test
        void tokenOfOneTenantCannotBeUsedAtAnother() {
            String auroraToken = api.login("aurora", "trader");
            var r = api.get("/api/portfolio", "kestrel", auroraToken);
            assertThat(r.status()).isEqualTo(403);
            assertThat(r.body().get("type").asString()).endsWith("/tenant-mismatch");
        }

        @Test
        void viewerCannotPlaceOrders() {
            var r = api.post("/api/orders", "aurora", api.login("aurora", "viewer"), marketOrder("AAPL", "BUY", "1"));
            assertThat(r.status()).isEqualTo(403);
        }

        @Test
        void meReturnsProfileFromToken() {
            var r = api.get("/api/me", "wisla", api.login("wisla", "trader"));
            assertThat(r.body().get("email").asString()).isEqualTo("trader@wisla.test");
            assertThat(r.body().get("roles").get(0).asString()).isEqualTo("TRADER");
        }
    }

    @Nested
    class Trading {

        @Test
        void marketBuyFillsAndUpdatesPortfolio() {
            String token = api.login("aurora", "trader");
            BigDecimal qtyBefore = quantity(api.get("/api/portfolio", "aurora", token).body(), "MSFT");
            BigDecimal cashBefore = api.get("/api/portfolio", "aurora", token).body().get("cash").decimalValue();

            var r = api.post("/api/orders", "aurora", token, marketOrder("MSFT", "BUY", "3"));
            assertThat(r.status()).isEqualTo(201);
            assertThat(r.body().get("status").asString()).isEqualTo("FILLED");

            // the portfolio is updated asynchronously by an @ApplicationModuleListener
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
                var p = api.get("/api/portfolio", "aurora", token).body();
                assertThat(quantity(p, "MSFT")).isEqualByComparingTo(qtyBefore.add(new BigDecimal("3")));
                assertThat(p.get("cash").decimalValue()).isLessThan(cashBefore);
            });
        }

        @Test
        void insufficientFundsIs422ProblemWithDetails() {
            var r = api.post("/api/orders", "aurora", api.login("aurora", "trader"), marketOrder("BTCUSD", "BUY", "1000"));
            assertThat(r.status()).isEqualTo(422);
            assertThat(r.body().get("type").asString()).endsWith("/insufficient-funds");
            assertThat(r.body().get("currency").asString()).isEqualTo("GBP");
            assertThat(r.body().has("required")).isTrue();
        }

        @Test
        void cannotSellMoreThanHeld() {
            var r = api.post("/api/orders", "kestrel", api.login("kestrel", "trader"), marketOrder("SAP", "SELL", "100000"));
            assertThat(r.status()).isEqualTo(422);
            assertThat(r.body().get("type").asString()).endsWith("/insufficient-position");
        }

        @Test
        void portfolioOnlyBrokerRejectsOrders() {
            var r = api.post("/api/orders", "sakura", api.login("sakura", "trader"), marketOrder("7203", "BUY", "1"));
            assertThat(r.status()).isEqualTo(403);
            assertThat(r.body().get("type").asString()).endsWith("/trading-disabled");
        }

        @Test
        void brokerWithoutLimitOrdersRejectsThem() {
            var r = api.post("/api/orders", "wisla", api.login("wisla", "trader"), limitOrder("PKO", "BUY", "1", "1"));
            assertThat(r.status()).isEqualTo(403);
            assertThat(r.body().get("type").asString()).endsWith("/limit-orders-disabled");
        }

        @Test
        void marketableLimitOrderFillsOnNextTick() {
            String token = api.login("kestrel", "trader");
            var r = api.post("/api/orders", "kestrel", token, limitOrder("SAP", "BUY", "1", "1000"));
            assertThat(r.status()).isEqualTo(201);
            assertThat(r.body().get("status").asString()).isEqualTo("OPEN");
            String id = r.body().get("id").asString();
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                    assertThat(api.get("/api/orders/" + id, "kestrel", token).body().get("status").asString())
                            .isEqualTo("FILLED"));
        }

        @Test
        void restingLimitOrderCanBeCancelledOnce() {
            String token = api.login("kestrel", "trader");
            var r = api.post("/api/orders", "kestrel", token, limitOrder("SAP", "BUY", "1", "1"));
            String id = r.body().get("id").asString();
            assertThat(api.delete("/api/orders/" + id, "kestrel", token).body().get("status").asString())
                    .isEqualTo("CANCELLED");
            var again = api.delete("/api/orders/" + id, "kestrel", token);
            assertThat(again.status()).isEqualTo(409);
        }

        @Test
        void invalidBodyIs400WithFieldErrors() {
            var body = new HashMap<String, Object>(marketOrder("AAPL", "BUY", "-5"));
            var r = api.post("/api/orders", "aurora", api.login("aurora", "trader"), body);
            assertThat(r.status()).isEqualTo(400);
            assertThat(r.body().get("errors").has("quantity")).isTrue();
        }
    }

    @Nested
    class SimulatorAndStreaming {

        @Test
        void failureRateOneMakesBusinessCallsFailWith503() {
            String token = api.login("aurora", "trader");
            var settings = Map.of("latencyMs", 0, "jitterMs", 0, "failureRate", 1.0, "volatilityMultiplier", 1.0,
                    "paused", false);
            assertThat(api.put("/api/simulator", "aurora", token, settings).status()).isEqualTo(200);
            var r = api.get("/api/portfolio", "aurora", token);
            assertThat(r.status()).isEqualTo(503);
            assertThat(r.body().get("retryable").asBoolean()).isTrue();
            api.post("/api/simulator/reset", "aurora", token, Map.of());
            assertThat(api.get("/api/portfolio", "aurora", token).status()).isEqualTo(200);
        }

        @Test
        void streamsQuotesAsServerSentEvents() throws Exception {
            var request = HttpRequest.newBuilder(URI.create(api.base() + "/api/market/stream?tenant=wisla")).build();
            var res = api.http().send(request, HttpResponse.BodyHandlers.ofInputStream());
            assertThat(res.headers().firstValue("Content-Type").orElse("")).startsWith("text/event-stream");
            try (var reader = new BufferedReader(new InputStreamReader(res.body(), StandardCharsets.UTF_8))) {
                String line;
                boolean sawEvent = false;
                while ((line = reader.readLine()) != null) {
                    if (line.equals("event:quotes")) {
                        sawEvent = true;
                    }
                    if (sawEvent && line.startsWith("data:")) {
                        assertThat(line).contains("\"symbol\":\"PKO\"");
                        break;
                    }
                }
                assertThat(sawEvent).isTrue();
            }
        }

        @Test
        void openApiDocumentDescribesTheApi() {
            var r = api.get("/v3/api-docs", null, null);
            assertThat(r.status()).isEqualTo(200);
            assertThat(r.body().get("paths").has("/api/orders")).isTrue();
            assertThat(r.body().get("components").get("securitySchemes").has("bearer")).isTrue();
        }
    }

    // ---- helpers ------------------------------------------------------------------------

    private static Map<String, Object> marketOrder(String symbol, String side, String qty) {
        return Map.of("symbol", symbol, "side", side, "type", "MARKET", "quantity", new BigDecimal(qty));
    }

    private static Map<String, Object> limitOrder(String symbol, String side, String qty, String limit) {
        return Map.of("symbol", symbol, "side", side, "type", "LIMIT", "quantity", new BigDecimal(qty),
                "limitPrice", new BigDecimal(limit));
    }

    private static BigDecimal quantity(JsonNode portfolio, String symbol) {
        for (JsonNode p : portfolio.get("positions")) {
            if (p.get("symbol").asString().equals(symbol)) {
                return p.get("quantity").decimalValue();
            }
        }
        return BigDecimal.ZERO;
    }
}
