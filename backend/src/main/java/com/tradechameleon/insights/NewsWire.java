package com.tradechameleon.insights;

import com.tradechameleon.market.Instrument;
import com.tradechameleon.market.MarketData;
import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.tenant.Tenant;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Simulated news wire. For every instrument and every hour of the last day a seeded generator decides
 * whether a headline was published and fills a template for the asset class and sentiment. The same
 * hour always yields the same headline, so lists are stable between requests and in tests.
 */
@Service
class NewsWire {

    private static final String[] SOURCES = {"Chameleon Wire", "Market Pulse", "Desk Notes", "Ticker Daily"};

    /** {name} and {pct} are replaced; {driver} comes from DRIVERS. */
    private static final Map<NewsItem.Sentiment, List<String>> TEMPLATES = Map.of(
            NewsItem.Sentiment.POSITIVE, List.of(
                    "{name} climbs {pct}% as {driver}",
                    "Buyers return to {name} after {driver}",
                    "Analysts turn bullish on {name}: {driver}"),
            NewsItem.Sentiment.NEGATIVE, List.of(
                    "{name} slips {pct}% as {driver}",
                    "Sellers press {name} after {driver}",
                    "Caution on {name} as {driver}"),
            NewsItem.Sentiment.NEUTRAL, List.of(
                    "{name} trades sideways as markets await {driver}",
                    "{name} steady; traders weigh {driver}",
                    "What to watch in {name}: {driver}"));

    private static final Map<AssetClass, List<String>> DRIVERS = Map.of(
            AssetClass.STOCK, List.of("quarterly earnings beat estimates", "a new product launch", "guidance is revised",
                    "a large fund changes its stake", "sector rotation picks up"),
            AssetClass.ETF, List.of("fund inflows accelerate", "index rebalancing nears", "broad market sentiment shifts"),
            AssetClass.FX, List.of("central bank comments", "inflation data surprises", "yield spreads widen",
                    "risk appetite changes"),
            AssetClass.CRYPTO, List.of("on-chain activity jumps", "ETF flows shift", "a major exchange update",
                    "regulatory headlines"),
            AssetClass.BOND, List.of("the inflation outlook changes", "auction demand is in focus", "rate expectations move"),
            AssetClass.COMMODITY, List.of("inventories are reported", "supply concerns grow", "the dollar moves",
                    "weather forecasts change"),
            AssetClass.INDEX, List.of("earnings season heats up", "macro data lands", "heavyweights lead the session",
                    "volatility picks up"));

    private final MarketData market;
    private final Clock clock;

    @Autowired
    NewsWire(MarketData market) {
        this(market, Clock.systemUTC());
    }

    NewsWire(MarketData market, Clock clock) {
        this.market = market;
        this.clock = clock;
    }

    List<NewsItem> latest(Tenant tenant, String symbol, AssetClass assetClass, int limit) {
        Instant now = clock.instant();
        List<NewsItem> items = new ArrayList<>();
        for (Instrument i : market.instruments(tenant)) {
            if (symbol != null && !i.symbol().equalsIgnoreCase(symbol)) continue;
            if (assetClass != null && i.assetClass() != assetClass) continue;
            items.addAll(forInstrument(i, now));
        }
        items.sort(Comparator.comparing(NewsItem::time).reversed());
        return items.size() > limit ? items.subList(0, limit) : items;
    }

    /** Headlines about one instrument in the 24 hours before {@code now}. */
    static List<NewsItem> forInstrument(Instrument instrument, Instant now) {
        List<NewsItem> result = new ArrayList<>();
        Instant currentHour = now.truncatedTo(ChronoUnit.HOURS);
        for (int h = 0; h < 24; h++) {
            Instant hour = currentHour.minus(Duration.ofHours(h));
            var random = new Random(instrument.symbol().hashCode() * 31L + hour.getEpochSecond());
            if (random.nextDouble() > 0.18) {
                continue;
            }
            Instant time = hour.plusSeconds(random.nextInt(3600));
            if (time.isAfter(now)) {
                continue;
            }
            var sentiment = NewsItem.Sentiment.values()[random.nextInt(3)];
            var templates = TEMPLATES.get(sentiment);
            var drivers = DRIVERS.getOrDefault(instrument.assetClass(), List.of("market conditions change"));
            String driver = drivers.get(random.nextInt(drivers.size()));
            String pct = String.format(java.util.Locale.ROOT, "%.1f", 0.3 + random.nextDouble() * 2.5);
            String headline = templates.get(random.nextInt(templates.size()))
                    .replace("{name}", instrument.name()).replace("{pct}", pct).replace("{driver}", driver);
            String summary = switch (sentiment) {
                case POSITIVE -> "Momentum improved for " + instrument.symbol() + " as " + driver + ". Desk flows lean to the buy side.";
                case NEGATIVE -> "Pressure built on " + instrument.symbol() + " as " + driver + ". Short-term traders reduced exposure.";
                case NEUTRAL -> "Volumes in " + instrument.symbol() + " were light; participants are positioning ahead of " + driver + ".";
            };
            result.add(new NewsItem(instrument.symbol() + "-" + hour.getEpochSecond(), time, instrument.symbol(),
                    instrument.assetClass(), headline, summary, sentiment, SOURCES[random.nextInt(SOURCES.length)]));
        }
        return result;
    }
}
