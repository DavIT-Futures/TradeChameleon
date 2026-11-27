package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Two administrative levels: a MAINTAINER manages exactly one broker from that broker's own site, the
 * platform ADMIN manages all of them from a separate console with a separate kind of token.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class AdminRolesIntegrationTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    int port;

    ApiClient api;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> settings(JsonNode broker) {
        Map<String, Object> all = JSON.convertValue(broker, Map.class);
        var s = new java.util.LinkedHashMap<String, Object>();
        for (String key : List.of("name", "tagline", "locale", "currency", "allowedAssetClasses", "spreadMarkupBps",
                "logoShape", "theme", "features", "limits")) {
            s.put(key, all.get(key));
        }
        return s;
    }

    @Test
    void maintainerManagesOnlyTheirOwnBroker() {
        String maintainer = api.login("pulse", "maintainer");

        var own = api.get("/api/tenant-admin/broker", "pulse", maintainer);
        assertThat(own.status()).isEqualTo(200);
        assertThat(own.body().get("id").asString()).isEqualTo("pulse");

        // the same token against another broker: rejected at the edge
        var other = api.get("/api/tenant-admin/broker", "kestrel", maintainer);
        assertThat(other.status()).isEqualTo(403);
        assertThat(other.body().get("type").asString()).endsWith("/tenant-mismatch");

        // and the platform console is not for maintainers
        assertThat(api.get("/api/platform/tenants", "pulse", maintainer).status()).isEqualTo(403);
        assertThat(api.put("/api/platform/tenants/kestrel", "pulse", maintainer, settings(own.body())).status())
                .isEqualTo(403);

        // traders and viewers have no admin page at all
        assertThat(api.get("/api/tenant-admin/broker", "pulse", api.login("pulse", "trader")).status()).isEqualTo(403);
        assertThat(api.get("/api/tenant-admin/broker", "pulse", api.login("pulse", "viewer")).status()).isEqualTo(403);
    }

    @Test
    void maintainerChangesAreLiveAndAudited() {
        String maintainer = api.login("alpenrose", "maintainer");
        var original = settings(api.get("/api/tenant-admin/broker", "alpenrose", maintainer).body());
        var changed = new java.util.LinkedHashMap<>(original);
        changed.put("tagline", "Private banking since 1888");
        try {
            var r = api.put("/api/tenant-admin/broker", "alpenrose", maintainer, changed);
            assertThat(r.status()).isEqualTo(200);
            assertThat(api.get("/api/tenants/alpenrose", null, null).body().get("tagline").asString())
                    .isEqualTo("Private banking since 1888");
            org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).untilAsserted(() ->
                    assertThat(api.get("/api/tenant-admin/changes", "alpenrose", maintainer).body().get(0)
                            .get("changedBy").asString()).isEqualTo("maintainer@alpenrose.test"));
        } finally {
            assertThat(api.put("/api/tenant-admin/broker", "alpenrose", maintainer, original).status()).isEqualTo(200);
        }
    }

    @Test
    void platformAdminHasItsOwnLoginAndTokenKind() {
        // the old broker-bound admin is gone
        var old = api.post("/api/auth/token", "aurora", null, Map.of("username", "admin@aurora.test", "password", "demo"));
        assertThat(old.status()).isEqualTo(401);
        // platform users cannot sign in to a broker, broker users cannot sign in to the platform
        assertThat(api.post("/api/auth/token", "aurora", null,
                Map.of("username", "admin@tradechameleon.com", "password", "demo")).status()).isEqualTo(401);
        assertThat(api.post("/api/platform/auth/token", null, null,
                Map.of("username", "maintainer@aurora.test", "password", "demo")).status()).isEqualTo(401);

        var login = api.post("/api/platform/auth/token", null, null,
                Map.of("username", "admin@tradechameleon.com", "password", "demo"));
        assertThat(login.status()).isEqualTo(200);
        assertThat(login.body().get("user").get("roles").toString()).contains("ADMIN");
        assertThat(login.body().get("user").get("tenant").isNull()).isTrue();
        String admin = login.body().get("accessToken").asString();

        assertThat(api.get("/api/platform/tenants", null, admin).body().size()).isEqualTo(6);

        // a platform token is useless on a broker's endpoints, even the broker admin ones
        for (String path : new String[] {"/api/portfolio", "/api/me", "/api/tenant-admin/broker"}) {
            var r = api.get(path, "aurora", admin);
            assertThat(r.status()).as(path).isEqualTo(403);
            assertThat(r.body().get("type").asString()).as(path).endsWith("/wrong-audience");
        }
        // ...but public endpoints still work with it
        assertThat(api.get("/api/tenants/current", "aurora", admin).status()).isEqualTo(200);
    }
}
