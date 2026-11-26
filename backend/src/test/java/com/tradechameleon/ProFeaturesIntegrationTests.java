package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;

/**
 * End-to-end tests of the "pro" features: stop orders, SL/TP, candles, depth, watchlist, alerts,
 * account statement and realised P&amp;L. Some tests raise the simulator's volatility so that prices
 * reach nearby triggers within a few ticks.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class ProFeaturesIntegrationTests {

    @LocalServerPort
    int port;

    ApiClient api;
    String trader;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
        trader = api.login("aurora", "trader");
        api.post("/api/simulator/reset", "aurora", trader, Map.of());
    }

    @AfterEach
    void calmDown() {
        api.post("/api/simulator/reset", "aurora", trader, Map.of());
    }

    private void wildMarket() {
        api.put("/api/simulator", "aurora", trader, Map.of("latencyMs", 0, "jitterMs", 0, "failureRate", 0.0,
                "volatilityMultiplier", 20.0, "paused", false));
    }

    private JsonNode quote(String symbol) {
        return api.get("/api/market/instruments/" + symbol, "aurora", null).body().get("quote");
    }

    @Nested
    class StopOrdersAndProtection {

        @Test
        void buyStopBelowTheMarketIsRejected() {
            BigDecimal ask = quote("MSFT").get("ask").decimalValue();
            var r = api.post("/api/orders", "aurora", trader, order("MSFT", "BUY", "STOP", "1", null,
                    ask.subtract(BigDecimal.TEN), null, null));
            assertThat(r.status()).isEqualTo(422);
            assertThat(r.body().get("type").asString()).endsWith("/invalid-stop");
        }

        @Test
        void sellStopTriggersAndFills() {
            wildMarket();
            BigDecimal bid = quote("AAPL").get("bid").decimalValue();
            var r = api.post("/api/orders", "aurora", trader, order("AAPL", "SELL", "STOP", "1", null,
                    bid.multiply(new BigDecimal("0.999")).setScale(2, RoundingMode.DOWN), null, null));
            assertThat(r.status()).isEqualTo(201);
            assertThat(r.body().get("status").asString()).isEqualTo("OPEN");
            String id = r.body().get("id").asString();
            await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                    assertThat(api.get("/api/orders/" + id, "aurora", trader).body().get("status").asString())
                            .isEqualTo("FILLED"));
        }

        @Test
        void protectionMustBeOnTheRightSideOfTheEntry() {
            BigDecimal ask = quote("NVDA").get("ask").decimalValue();
            var r = api.post("/api/orders", "aurora", trader, order("NVDA", "BUY", "MARKET", "1", null, null,
                    ask.add(BigDecimal.ONE), null));
            assertThat(r.status()).isEqualTo(422);
            assertThat(r.body().get("type").asString()).endsWith("/invalid-protection");

            var sell = api.post("/api/orders", "aurora", trader, order("AAPL", "SELL", "MARKET", "1", null, null,
                    BigDecimal.ONE, null));
            assertThat(sell.status()).isEqualTo(400);
        }

        @Test
        void takeProfitOrStopLossClosesThePositionAndRealisesPnl() {
            BigDecimal ask = quote("NVDA").get("ask").decimalValue();
            var r = api.post("/api/orders", "aurora", trader, order("NVDA", "BUY", "MARKET", "2", null, null,
                    ask.multiply(new BigDecimal("0.998")).setScale(2, RoundingMode.DOWN),
                    ask.multiply(new BigDecimal("1.002")).setScale(2, RoundingMode.UP)));
            assertThat(r.status()).isEqualTo(201);

            // the fill is applied asynchronously and attaches SL/TP to the position
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                    assertThat(position(api.get("/api/portfolio", "aurora", trader).body(), "NVDA")).isNotNull());
            wildMarket();

            await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
                assertThat(position(api.get("/api/portfolio", "aurora", trader).body(), "NVDA")).isNull();
                var closed = api.get("/api/portfolio/closed-trades", "aurora", trader).body();
                assertThat(closed.size()).isGreaterThan(0);
                assertThat(closed.get(0).get("symbol").asString()).isEqualTo("NVDA");
            });
            var orders = api.get("/api/orders?limit=5", "aurora", trader).body();
            assertThat(orders.get(0).get("origin").asString()).isIn("STOP_LOSS", "TAKE_PROFIT");
        }

        @Test
        void protectionCanBeEditedOnAnOpenPosition() {
            BigDecimal bid = quote("SPY").get("bid").decimalValue();
            var body = new HashMap<String, Object>();
            body.put("stopLoss", bid.subtract(new BigDecimal("50")));
            body.put("takeProfit", null);
            var r = api.put("/api/portfolio/positions/SPY/protection", "aurora", trader, body);
            assertThat(r.status()).isEqualTo(200);
            assertThat(position(r.body(), "SPY").get("stopLoss").decimalValue())
                    .isEqualByComparingTo(bid.subtract(new BigDecimal("50")));
            body.put("stopLoss", null);
            api.put("/api/portfolio/positions/SPY/protection", "aurora", trader, body);
        }
    }

    @Nested
    class MarketAnalytics {

        @Test
        void candlesAreConsistentOhlc() {
            var candles = api.get("/api/market/instruments/AAPL/candles?interval=1m&limit=10", "aurora", null).body();
            assertThat(candles.size()).isBetween(1, 10);
            for (JsonNode c : candles) {
                BigDecimal high = c.get("high").decimalValue();
                BigDecimal low = c.get("low").decimalValue();
                assertThat(high).isGreaterThanOrEqualTo(low);
                assertThat(c.get("open").decimalValue()).isBetween(low, high);
                assertThat(c.get("close").decimalValue()).isBetween(low, high);
            }
            assertThat(api.get("/api/market/instruments/AAPL/candles?interval=7m", "aurora", null).status()).isEqualTo(400);
        }

        @Test
        void depthHasSortedLevelsAroundTheQuote() {
            var book = api.get("/api/market/instruments/SAP/depth?levels=10", "kestrel", null).body();
            assertThat(book.get("bids").size()).isEqualTo(10);
            assertThat(book.get("asks").size()).isEqualTo(10);
            BigDecimal bestBid = book.get("bids").get(0).get("price").decimalValue();
            BigDecimal bestAsk = book.get("asks").get(0).get("price").decimalValue();
            assertThat(bestBid).isLessThan(bestAsk);
            assertThat(book.get("bids").get(9).get("price").decimalValue()).isLessThan(bestBid);
            assertThat(book.get("asks").get(9).get("price").decimalValue()).isGreaterThan(bestAsk);
        }
    }

    @Nested
    class WatchlistAndAlerts {

        @Test
        void watchlistIsSeededAndToggles() {
            var list = api.get("/api/watchlist", "aurora", trader).body();
            assertThat(list.toString()).contains("AAPL");
            assertThat(api.put("/api/watchlist/MSFT", "aurora", trader, Map.of()).status()).isEqualTo(204);
            assertThat(api.get("/api/watchlist", "aurora", trader).body().toString()).contains("MSFT");
            assertThat(api.delete("/api/watchlist/MSFT", "aurora", trader).status()).isEqualTo(204);
            assertThat(api.get("/api/watchlist", "aurora", trader).body().toString()).doesNotContain("MSFT");
            // instruments the broker does not offer cannot be added
            assertThat(api.put("/api/watchlist/PL10Y", "aurora", trader, Map.of()).status()).isEqualTo(404);
        }

        @Test
        void alertAlreadyMetIsRejected() {
            BigDecimal mid = quote("AAPL").get("mid").decimalValue();
            var r = api.post("/api/alerts", "aurora", trader, Map.of("symbol", "AAPL", "condition", "BELOW",
                    "price", mid.add(BigDecimal.TEN)));
            assertThat(r.status()).isEqualTo(422);
            assertThat(r.body().get("type").asString()).endsWith("/alert-already-met");
        }

        @Test
        void alertFiresBecomesANotificationAndCanBeAcknowledged() {
            BigDecimal mid = quote("BTCUSD").get("mid").decimalValue();
            var r = api.post("/api/alerts", "aurora", trader, Map.of("symbol", "BTCUSD", "condition", "ABOVE",
                    "price", mid.multiply(new BigDecimal("1.001")).setScale(2, RoundingMode.UP), "note", "test"));
            assertThat(r.status()).isEqualTo(201);
            String id = r.body().get("id").asString();
            wildMarket();
            await().atMost(Duration.ofSeconds(30)).untilAsserted(() ->
                    assertThat(api.get("/api/alerts/notifications", "aurora", trader).body().toString()).contains(id));
            assertThat(api.post("/api/alerts/" + id + "/ack", "aurora", trader, Map.of()).status()).isEqualTo(204);
            assertThat(api.get("/api/alerts/notifications", "aurora", trader).body().toString()).doesNotContain(id);
            assertThat(api.delete("/api/alerts/" + id, "aurora", trader).status()).isEqualTo(409);
        }

        @Test
        void activeAlertCanBeCancelled() {
            BigDecimal mid = quote("AAPL").get("mid").decimalValue();
            var r = api.post("/api/alerts", "aurora", trader, Map.of("symbol", "AAPL", "condition", "ABOVE",
                    "price", mid.multiply(BigDecimal.TWO)));
            String id = r.body().get("id").asString();
            assertThat(api.delete("/api/alerts/" + id, "aurora", trader).body().get("status").asString())
                    .isEqualTo("CANCELLED");
        }
    }

    @Nested
    class AccountStatement {

        @Test
        void depositAndWithdrawalAppearInTheStatement() {
            String token = api.login("wisla", "trader");
            var dep = api.post("/api/portfolio/deposits", "wisla", token, Map.of("amount", 5000));
            assertThat(dep.status()).isEqualTo(201);
            assertThat(dep.body().get("type").asString()).isEqualTo("DEPOSIT");
            var wd = api.post("/api/portfolio/withdrawals", "wisla", token, Map.of("amount", 1000));
            assertThat(wd.body().get("amount").decimalValue()).isEqualByComparingTo("-1000");
            assertThat(wd.body().get("balanceAfter").decimalValue())
                    .isEqualByComparingTo(dep.body().get("balanceAfter").decimalValue().subtract(new BigDecimal("1000")));
            var statement = api.get("/api/portfolio/transactions?limit=500", "wisla", token).body();
            assertThat(statement.toString()).contains("Opening deposit");
        }

        @Test
        void cannotWithdrawMoreThanCashAndViewerCannotMoveMoney() {
            String token = api.login("wisla", "trader");
            var r = api.post("/api/portfolio/withdrawals", "wisla", token, Map.of("amount", 99_000_000));
            assertThat(r.status()).isEqualTo(422);
            var viewer = api.post("/api/portfolio/deposits", "wisla", api.login("wisla", "viewer"), Map.of("amount", 1));
            assertThat(viewer.status()).isEqualTo(403);
        }

        @Test
        void tradesAreBookedInTheLedger() {
            String token = api.login("kestrel", "trader");
            var r = api.post("/api/orders", "kestrel", token, order("ASML", "BUY", "MARKET", "1", null, null, null, null));
            String orderId = r.body().get("id").asString();
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                    assertThat(api.get("/api/portfolio/transactions?limit=5", "kestrel", token).body().toString())
                            .contains(orderId));
        }
    }

    // ---- helpers ----------------------------------------------------------------------------

    private static Map<String, Object> order(String symbol, String side, String type, String qty, BigDecimal limit,
                                             BigDecimal stop, BigDecimal stopLoss, BigDecimal takeProfit) {
        var m = new HashMap<String, Object>();
        m.put("symbol", symbol);
        m.put("side", side);
        m.put("type", type);
        m.put("quantity", new BigDecimal(qty));
        m.put("limitPrice", limit);
        m.put("stopPrice", stop);
        m.put("stopLoss", stopLoss);
        m.put("takeProfit", takeProfit);
        return m;
    }

    private static JsonNode position(JsonNode portfolio, String symbol) {
        for (JsonNode p : portfolio.get("positions")) {
            if (p.get("symbol").asString().equals(symbol)) {
                return p;
            }
        }
        return null;
    }
}
