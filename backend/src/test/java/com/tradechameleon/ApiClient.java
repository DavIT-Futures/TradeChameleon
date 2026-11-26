package com.tradechameleon;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Tiny HTTP helper for the integration tests: real HTTP against the embedded server on a random port,
 * exactly what the browser clients do (headers, JSON bodies, bearer tokens).
 */
final class ApiClient {

    record Response(int status, String contentType, JsonNode body, String raw) {
    }

    private final HttpClient http = HttpClient.newHttpClient();
    private final JsonMapper json = JsonMapper.builder().build();
    private final String base;

    ApiClient(int port) {
        this.base = "http://localhost:" + port;
    }

    Response get(String path, String tenant, String token) {
        return send(builder(path, tenant, token).GET());
    }

    Response post(String path, String tenant, String token, Object body) {
        return send(builder(path, tenant, token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))));
    }

    Response put(String path, String tenant, String token, Object body) {
        return send(builder(path, tenant, token)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))));
    }

    Response delete(String path, String tenant, String token) {
        return send(builder(path, tenant, token).DELETE());
    }

    String login(String tenant, String role) {
        var r = post("/api/auth/token", tenant, null,
                java.util.Map.of("username", role + "@" + tenant + ".test", "password", "demo"));
        if (r.status() != 200) {
            throw new IllegalStateException("Login failed: " + r.raw());
        }
        return r.body().get("accessToken").asString();
    }

    HttpClient http() {
        return http;
    }

    String base() {
        return base;
    }

    private HttpRequest.Builder builder(String path, String tenant, String token) {
        var b = HttpRequest.newBuilder(URI.create(base + path));
        if (tenant != null) {
            b.header("X-Tenant-Id", tenant);
        }
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        return b;
    }

    private Response send(HttpRequest.Builder builder) {
        try {
            var res = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode node = res.body().isBlank() || !res.body().trim().startsWith("{") && !res.body().trim().startsWith("[")
                    ? null : json.readTree(res.body());
            return new Response(res.statusCode(), res.headers().firstValue("Content-Type").orElse(""), node, res.body());
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
