# 🦎 TradeChameleon

A multi-tenant, white-label **training** trading platform. Four fictional brokers share one code base;
each has its own generated SVG logo, colors, fonts, locale, currency, allowed asset classes, spread
markup and feature flags. One broker is portfolio-only (no trading).

| Layer | Stack |
|---|---|
| Backend | Java 25, Spring Boot 4.2, Spring Modulith (event-driven modules), virtual threads, `ScopedValue` |
| Data | PostgreSQL 18 (Docker Compose), Flyway, `JdbcClient`, deterministic seed data |
| Security | OAuth2 resource server, RS256 JWT from a built-in dev identity provider, swappable for corporate SSO via OIDC |
| API | REST + Server-Sent Events, RFC 9457 Problem Details, OpenAPI 3.1 with Swagger UI and Scalar |
| Angular client | Angular 21: standalone, zoneless, signals, `httpResource`, functional interceptors and guards, `@defer`, Vitest |
| React client | React 19, Vite, React Router, TanStack Query, `useSyncExternalStore`, Vitest + Testing Library |
| Styling | Plain modern CSS shared by both clients, themed with custom properties |

📘 **The full technical guide (≈30 chapters, Polish/English, Mermaid diagrams, real code and real API responses) is in [`docs/guide.html`](docs/guide.html).**

## Brokers

| Id | Name | Locale / currency | Asset classes | Markup | Notes |
|---|---|---|---|---|---|
| `aurora` | Aurora Markets | en-GB / GBP | STOCK, ETF, FX, CRYPTO | 5 bps | default broker |
| `kestrel` | Kestrel Trade | de-DE / EUR | STOCK, ETF, CRYPTO | 12 bps | dark theme |
| `wisla` | Wisła Invest | pl-PL / PLN | STOCK, ETF, BOND, FX | 20 bps | market orders only |
| `sakura` | Sakura Wealth | ja-JP / JPY | STOCK, ETF, BOND | 0 bps | portfolio only |

The broker is resolved from the `*.localhost` subdomain, then `?tenant=`, then the `X-Tenant-Id` header,
otherwise the default (`aurora`).

Demo users (password `demo` for all): `trader@<tenant>.test` (role TRADER) and `viewer@<tenant>.test` (role VIEWER).

## Getting started

Prerequisites (Windows: `winget install EclipseAdoptium.Temurin.25.JDK OpenJS.NodeJS.LTS Microsoft.WSL Docker.DockerDesktop`):
JDK 25, Node 24+, Docker.

```powershell
docker compose up -d                          # PostgreSQL 18 on :5432

cd backend
.\mvnw spring-boot:run                        # API on http://localhost:8080

cd angular-client
npm install; npm start                        # http://localhost:4200  (try http://kestrel.localhost:4200)

cd react-client
npm install; npm run dev                      # http://localhost:5173  (try http://wisla.localhost:5173)
```

Useful URLs: Swagger UI `http://localhost:8080/swagger-ui.html`, Scalar `http://localhost:8080/scalar`,
OpenAPI `http://localhost:8080/v3/api-docs`, modules `http://localhost:8080/actuator/modulith`.

No Docker? Set `SPRING_DOCKER_COMPOSE_ENABLED=false` and point `spring.datasource.*` at any PostgreSQL.

## Tests

```powershell
cd backend;        .\mvnw test            # JUnit, Testcontainers (needs Docker), Modulith verification
cd angular-client; npm test               # Vitest
cd react-client;   npm test               # Vitest + Testing Library
```

Without Docker the backend integration tests can use an existing database:
`.\mvnw test "-Dtc.test.external-db=true" "-Dspring.datasource.url=jdbc:postgresql://localhost:5432/tradechameleon_test"`.

## Regenerating the API types

Both clients use TypeScript types generated from `openapi/openapi.json`. With the backend running:

```powershell
curl.exe http://localhost:8080/v3/api-docs -o openapi/openapi.json
cd angular-client; npm run gen:api
cd react-client;   npm run gen:api
```

## Repository layout

```
backend/          Spring Boot 4 modular monolith (tenant, identity, market, simulator, trading, portfolio, shared)
angular-client/   Angular 21 client
react-client/     React 19 client
shared/styles/    CSS design system shared by both clients
openapi/          OpenAPI contract (source of the TypeScript types)
docs/guide.html   Technical guide (PL/EN)
compose.yaml      PostgreSQL for local development
legacy/dotnet/    Earlier C# scaffolding, kept for reference
```

## License

MIT. Brokers, prices and users are fictional; this is not investment software.
