# 🦎 TradeChameleon

[![Release](https://img.shields.io/github/v/release/DavIT-Futures/TradeChameleon?color=brightgreen&label=Release)](https://github.com/DavIT-Futures/TradeChameleon/releases/latest)
[![CI](https://github.com/DavIT-Futures/TradeChameleon/actions/workflows/ci.yml/badge.svg)](https://github.com/DavIT-Futures/TradeChameleon/actions/workflows/ci.yml)
[![Guide](https://github.com/DavIT-Futures/TradeChameleon/actions/workflows/pages.yml/badge.svg)](https://davit-futures.github.io/TradeChameleon/)
[![Java 25](https://img.shields.io/badge/Java-25-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot 4](https://img.shields.io/badge/Spring%20Boot-4.2-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Angular 21](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Dawid%20Domaga%C5%82a%20(DavIT--Futures)-orange.svg)](https://github.com/DavIT-Futures)

A multi-tenant, white-label **training** trading platform. Six fictional brokers share one code base;
each has its own generated SVG logo, colors, fonts, locale, currency, allowed asset classes, spread
markup, feature flags and order limits. One broker is portfolio-only (no trading); others switch off
whole tools (screener, calendar, risk view…) or cap order sizes, enforced by the API, not just hidden in the UI.

| Layer | Stack |
|---|---|
| Backend | Java 25, Spring Boot 4.2, Spring Modulith (event-driven modules), virtual threads, `ScopedValue` |
| Data | PostgreSQL 18 (Docker Compose), Flyway, `JdbcClient`, deterministic seed data |
| Security | OAuth2 resource server, RS256 JWT from a built-in dev identity provider, swappable for corporate SSO via OIDC |
| API | REST + Server-Sent Events, RFC 9457 Problem Details, OpenAPI 3.1 with Swagger UI and Scalar |
| Angular client | Angular 21: standalone, zoneless, signals, `httpResource`, functional interceptors and guards, `@defer`, Vitest |
| React client | React 19, Vite, React Router, TanStack Query, `useSyncExternalStore`, Vitest + Testing Library |
| Styling | Plain modern CSS shared by both clients, themed with custom properties |

📘 **Technical guide (44 chapters, Polish/English, Mermaid diagrams, real code and real API responses):
[davit-futures.github.io/TradeChameleon](https://davit-futures.github.io/TradeChameleon/)**. The source is
[`docs/guide.html`](docs/guide.html); the [Publish guide](.github/workflows/pages.yml) workflow deploys it to GitHub Pages on every push to `main`.

## Trading features

- 37 instruments in 8 asset classes: stocks, ETFs, forex, crypto, bonds, **commodities**, **indices** and **options**
- **Market browser**: overview per class (breadth, best/worst), class tabs, sub-categories, search and sorting
- Class-specific **contract details** (pips and pip value for FX, contract value for commodities, value per point for indices)
- **Option chains** with Black-Scholes prices and greeks (Δ, Γ, Θ, ν, IV) for optionable underlyings
- Live prices over SSE with per-broker spreads, sparklines and price flashes
- Market, limit, **stop** and **stop-limit** orders; **stop-loss / take-profit** on positions, closed automatically
- **Candlestick chart** (5s / 15s / 1m / 5m) with **SMA 20, EMA 9 and RSI 14**, plus a line chart
- **Market depth** (10 bid/ask levels), **watchlist** and **price alerts** with in-app notifications
- **Screener** (presets and custom filters on change, RSI, volatility, spread), **compare** up to 4 instruments
- **Economic calendar**, **news** with sentiment and simulated **client long/short sentiment**
- **Risk & margin** view (ESMA-style CFD margin rates, margin level, leverage, concentration warnings)
- **Light/dark override** on top of each broker's theme
- Portfolio valued live in the broker currency, **account statement** (deposits, withdrawals, trade cash flows)
  and **closed trades with realised P&L**
- **Two admin levels**: each broker's **maintainer** edits only that broker on its own site (`/admin`);
  the **platform super admin** has a separate console at `admin.localhost` with all brokers side by side, a feature/limit matrix with differences highlighted, live usage,
  and an **editor for every broker setting** (branding, colours, fonts, locale, currency, asset classes, spread, feature flags,
  limits) with a live preview, server-side validation, changes live on the next request and an audit log
- Developer panel: latency, jitter, failure rate, volatility and pause for the simulated market

## Brokers

| Id | Name | Locale / currency | Asset classes | Markup | Notes |
|---|---|---|---|---|---|
| `aurora` | Aurora Markets | en-GB / GBP | STOCK, ETF, FX, CRYPTO, COMMODITY, INDEX, OPTION | 5 bps | default broker |
| `kestrel` | Kestrel Trade | de-DE / EUR | STOCK, ETF, CRYPTO, INDEX, OPTION | 12 bps | dark theme, max 20 pending orders |
| `wisla` | Wisła Invest | pl-PL / PLN | STOCK, ETF, BOND, FX, COMMODITY, INDEX | 20 bps | market orders only, no compare, max 200,000 PLN per order |
| `sakura` | Sakura Wealth | ja-JP / JPY | STOCK, ETF, BOND, INDEX | 0 bps | portfolio only, no screener or alerts |
| `alpenrose` | Alpenrose Private Bank | de-CH / CHF | STOCK, ETF, BOND, INDEX | 8 bps | all tools, max 50,000 CHF per order, max 5 pending orders |
| `pulse` | Pulse | en-US / USD | STOCK, ETF, CRYPTO | 35 bps | dark, market orders only, max 2,000 USD per order, no screener / calendar / compare / risk view |

The broker is resolved from the `*.localhost` subdomain, then `?tenant=`, then the `X-Tenant-Id` header,
otherwise the default (`aurora`).

Demo users (password `demo` for all): `trader@<tenant>.test` (role TRADER) and `viewer@<tenant>.test` (role VIEWER).
Broker maintainer: `maintainer@<tenant>.test` (roles MAINTAINER + VIEWER) gets an **Admin** page on that broker's site.
Platform super admin: `admin@tradechameleon.com` signs in to the separate console at `http://admin.localhost:4200`
(or `:5173`); its token has no tenant and works only on `/api/platform/**`.

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
backend/          Spring Boot 4 modular monolith (tenant, identity, market, simulator, trading, portfolio, watchlist, alerts, insights, admin, shared)
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
