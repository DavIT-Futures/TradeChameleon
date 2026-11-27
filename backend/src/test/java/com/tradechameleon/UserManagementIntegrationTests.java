package com.tradechameleon;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/** Maintainers manage the users of their own broker; the platform admin manages users of every broker. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tc.market.tick-interval=200ms"})
@Import(TestcontainersConfiguration.class)
class UserManagementIntegrationTests {

    @LocalServerPort
    int port;

    ApiClient api;

    @BeforeEach
    void setUp() {
        api = new ApiClient(port);
    }

    private ApiClient.Response loginAs(String tenant, String email, String password) {
        return api.post("/api/auth/token", tenant, null, Map.of("username", email, "password", password));
    }

    private static Map<String, Object> update(String name, List<String> roles, boolean enabled, String password) {
        var m = new HashMap<String, Object>();
        m.put("name", name);
        m.put("roles", roles);
        m.put("enabled", enabled);
        m.put("password", password);
        return m;
    }

    @Test
    void maintainerCreatesDisablesAndReEnablesUsersOfTheirBroker() {
        String maintainer = api.login("wisla", "maintainer");
        assertThat(api.get("/api/tenant-admin/users", "wisla", maintainer).body().size()).isEqualTo(3);

        var created = api.post("/api/tenant-admin/users", "wisla", maintainer,
                Map.of("email", "Nowy@Wisla.test", "name", "Nowy Inwestor", "password", "secret1", "roles", List.of("TRADER")));
        assertThat(created.status()).isEqualTo(201);
        assertThat(created.body().get("email").asString()).isEqualTo("nowy@wisla.test");
        assertThat(created.body().get("enabled").asBoolean()).isTrue();
        String id = created.body().get("id").asString();
        try {
            assertThat(loginAs("wisla", "nowy@wisla.test", "secret1").status()).isEqualTo(200);

            var duplicate = api.post("/api/tenant-admin/users", "wisla", maintainer,
                    Map.of("email", "nowy@wisla.test", "name", "Again", "password", "secret1", "roles", List.of("VIEWER")));
            assertThat(duplicate.status()).isEqualTo(409);
            assertThat(duplicate.body().get("type").asString()).endsWith("/email-taken");

            // disabled: the right password no longer gets a token
            assertThat(api.put("/api/tenant-admin/users/" + id, "wisla", maintainer,
                    update("Nowy Inwestor", List.of("TRADER"), false, null)).status()).isEqualTo(200);
            var disabled = loginAs("wisla", "nowy@wisla.test", "secret1");
            assertThat(disabled.status()).isEqualTo(403);
            assertThat(disabled.body().get("type").asString()).endsWith("/account-disabled");

            // enabled again with a new password and an extra role
            var r = api.put("/api/tenant-admin/users/" + id, "wisla", maintainer,
                    update("Nowy Inwestor", List.of("VIEWER", "TRADER"), true, "secret2"));
            assertThat(r.body().get("roles").toString()).contains("TRADER", "VIEWER");
            assertThat(loginAs("wisla", "nowy@wisla.test", "secret1").status()).isEqualTo(401);
            assertThat(loginAs("wisla", "nowy@wisla.test", "secret2").status()).isEqualTo(200);

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                    assertThat(api.get("/api/tenant-admin/changes", "wisla", maintainer).body().toString())
                            .contains("user created: nowy@wisla.test [TRADER]")
                            .contains("user nowy@wisla.test disabled")
                            .contains("user nowy@wisla.test password reset"));
        } finally {
            assertThat(api.delete("/api/tenant-admin/users/" + id, "wisla", maintainer).status()).isEqualTo(204);
        }
        assertThat(loginAs("wisla", "nowy@wisla.test", "secret2").status()).isEqualTo(401);
    }

    @Test
    void invalidUsersAreRejectedWithFieldErrors() {
        String maintainer = api.login("wisla", "maintainer");
        var r = api.post("/api/tenant-admin/users", "wisla", maintainer,
                Map.of("email", "not-an-email", "name", "", "password", "x", "roles", List.of()));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.body().get("errors").propertyNames()).contains("email", "name", "password", "roles");

        // ADMIN is a platform role, it does not exist on a broker
        var admin = api.post("/api/tenant-admin/users", "wisla", maintainer,
                Map.of("email", "boss@wisla.test", "name", "Boss", "password", "secret1", "roles", List.of("ADMIN")));
        assertThat(admin.status()).isEqualTo(400);
    }

    @Test
    void nobodyCanLockThemselvesOut() {
        String maintainer = api.login("kestrel", "maintainer");
        String me = api.get("/api/me", "kestrel", maintainer).body().get("id").asString();

        for (var body : List.of(update("Max Maintainer", List.of("MAINTAINER", "VIEWER"), false, null),
                update("Max Maintainer", List.of("VIEWER"), true, null))) {
            var r = api.put("/api/tenant-admin/users/" + me, "kestrel", maintainer, body);
            assertThat(r.status()).isEqualTo(422);
            assertThat(r.body().get("type").asString()).endsWith("/self-lockout");
        }
        assertThat(api.delete("/api/tenant-admin/users/" + me, "kestrel", maintainer).status()).isEqualTo(422);
    }

    @Test
    void maintainersCannotReachOtherBrokersUsers() {
        String maintainer = api.login("pulse", "maintainer");
        assertThat(api.get("/api/tenant-admin/users", "kestrel", maintainer).status()).isEqualTo(403);
        assertThat(api.get("/api/platform/tenants/kestrel/users", "pulse", maintainer).status()).isEqualTo(403);
        assertThat(api.get("/api/tenant-admin/users", "pulse", api.login("pulse", "trader")).status()).isEqualTo(403);
    }

    @Test
    void platformAdminManagesUsersOfAnyBrokerAndDeletionCleansUp() {
        String admin = api.platformLogin();
        assertThat(api.get("/api/platform/tenants/sakura/users", null, admin).body().size()).isEqualTo(3);

        var created = api.post("/api/platform/tenants/aurora/users", null, admin,
                Map.of("email", "temp@aurora.test", "name", "Temp Trader", "password", "secret1", "roles", List.of("TRADER")));
        assertThat(created.status()).isEqualTo(201);
        String id = created.body().get("id").asString();

        // the new user trades: a pending limit order far below the market
        String token = loginAs("aurora", "temp@aurora.test", "secret1").body().get("accessToken").asString();
        var order = new HashMap<String, Object>();
        order.put("symbol", "AAPL");
        order.put("side", "BUY");
        order.put("type", "LIMIT");
        order.put("quantity", BigDecimal.ONE);
        order.put("limitPrice", BigDecimal.ONE);
        var placed = api.post("/api/orders", "aurora", token, order);
        assertThat(placed.status()).isEqualTo(201);
        String orderId = placed.body().get("id").asString();

        assertThat(api.delete("/api/platform/tenants/aurora/users/" + id, null, admin).status()).isEqualTo(204);
        assertThat(loginAs("aurora", "temp@aurora.test", "secret1").status()).isEqualTo(401);
        // UserDeleted event -> the trading module cancels the pending order (history is kept)
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            var orders = api.get("/api/orders", "aurora", token).body();
            for (var o : orders) {
                if (o.get("id").asString().equals(orderId)) {
                    assertThat(o.get("status").asString()).isEqualTo("CANCELLED");
                }
            }
        });
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(api.get("/api/platform/tenants/aurora/changes", null, admin).body().get(0).toString())
                        .contains("user deleted: temp@aurora.test").contains("admin@tradechameleon.com"));
    }
}
