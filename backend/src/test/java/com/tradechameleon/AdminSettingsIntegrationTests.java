package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The admin panel edits every broker parameter; changes are validated, audited and live immediately. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class AdminSettingsIntegrationTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    int port;

    ApiClient api;
    String admin;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
        admin = api.login("aurora", "admin");
    }

    /** The editable part of a broker, as the admin client sends it (BrokerOverview minus usage figures). */
    @SuppressWarnings("unchecked")
    private Map<String, Object> settingsOf(String id) {
        JsonNode broker = null;
        for (JsonNode b : api.get("/api/admin/tenants", "aurora", admin).body()) {
            if (b.get("id").asString().equals(id)) {
                broker = b;
            }
        }
        Map<String, Object> all = JSON.convertValue(broker, Map.class);
        var settings = new java.util.LinkedHashMap<String, Object>();
        for (String key : List.of("name", "tagline", "locale", "currency", "allowedAssetClasses", "spreadMarkupBps",
                "logoShape", "theme", "features", "limits")) {
            settings.put(key, all.get(key));
        }
        return settings;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> nested(Map<String, Object> m, String key) {
        return (Map<String, Object>) m.get(key);
    }

    @Test
    void onlyAdminsMayChangeBrokers() {
        var settings = settingsOf("wisla");
        assertThat(api.put("/api/admin/tenants/wisla", "wisla", api.login("wisla", "trader"), settings).status())
                .isEqualTo(403);
        assertThat(api.put("/api/admin/tenants/wisla", "aurora", null, settings).status()).isEqualTo(401);
        assertThat(api.put("/api/admin/tenants/nope", "aurora", admin, settings).status()).isEqualTo(404);
    }

    @Test
    void invalidSettingsAreRejectedWithFieldErrors() {
        var settings = settingsOf("wisla");
        settings.put("locale", "polish");
        settings.put("allowedAssetClasses", List.of());
        settings.put("spreadMarkupBps", 9999);
        nested(settings, "theme").put("primary", "red; background:url(x)");
        nested(settings, "limits").put("maxOrderValue", 0);

        var r = api.put("/api/admin/tenants/wisla", "aurora", admin, settings);
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.body().get("type").asString()).endsWith("/validation");
        assertThat(r.body().get("errors").propertyNames())
                .contains("locale", "allowedAssetClasses", "spreadMarkupBps", "theme.primary", "limits.maxOrderValue");

        var currency = settingsOf("wisla");
        currency.put("currency", "XYZ");
        var unsupported = api.put("/api/admin/tenants/wisla", "aurora", admin, currency);
        assertThat(unsupported.status()).isEqualTo(422);
        assertThat(unsupported.body().get("type").asString()).endsWith("/unsupported-currency");
    }

    @Test
    void changesAreLiveImmediatelyAndAudited() {
        var original = settingsOf("pulse");
        String trader = api.login("pulse", "trader");
        assertThat(api.get("/api/market/calendar", "pulse", null).status()).isEqualTo(403);
        assertThat(api.get("/api/market/instruments/SAP", "pulse", null).status()).isEqualTo(200);

        var changed = settingsOf("pulse");
        changed.put("name", "Pulse Pro");
        changed.put("allowedAssetClasses", List.of("CRYPTO"));
        nested(changed, "features").put("calendar", true);
        nested(changed, "theme").put("primary", "#22d3ee");
        String oldLogo = api.get("/api/tenants/pulse", null, null).body().get("logoUrl").asString();
        try {
            var r = api.put("/api/admin/tenants/pulse", "aurora", admin, changed);
            assertThat(r.status()).isEqualTo(200);
            assertThat(r.body().get("name").asString()).isEqualTo("Pulse Pro");

            // live for the very next request, no restart, no re-login
            var current = api.get("/api/tenants/current", "pulse", trader).body();
            assertThat(current.get("name").asString()).isEqualTo("Pulse Pro");
            assertThat(current.get("theme").get("primary").asString()).isEqualTo("#22d3ee");
            assertThat(current.get("logoUrl").asString()).isNotEqualTo(oldLogo);
            assertThat(api.get("/api/market/calendar", "pulse", null).status()).isEqualTo(200);
            assertThat(api.get("/api/market/instruments/SAP", "pulse", null).status()).isEqualTo(404);

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
                var log = api.get("/api/admin/tenants/pulse/changes", "aurora", admin).body();
                assertThat(log.get(0).get("changedBy").asString()).isEqualTo("admin@aurora.test");
                assertThat(log.get(0).get("changes").toString())
                        .contains("name: Pulse → Pulse Pro")
                        .contains("features.calendar: false → true")
                        .contains("theme.primary: #a3e635 → #22d3ee");
            });
        } finally {
            assertThat(api.put("/api/admin/tenants/pulse", "aurora", admin, original).status()).isEqualTo(200);
        }
        assertThat(api.get("/api/market/calendar", "pulse", null).status()).isEqualTo(403);
    }

    @Test
    void editorOptionsListSupportedValues() {
        var options = api.get("/api/admin/settings-options", "aurora", admin).body();
        assertThat(options.get("currencies").toString()).contains("CHF", "PLN", "USD");
        assertThat(options.get("assetClasses")).hasSize(8);
        assertThat(options.get("logoShapes").toString()).contains("monogram", "pulse");
    }
}
