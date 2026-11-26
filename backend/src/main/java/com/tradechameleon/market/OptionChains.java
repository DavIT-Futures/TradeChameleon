package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.shared.DomainException;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Builds option chains on the fly from the live spot price: weekly and monthly Friday expiries,
 * 11 strikes around the money, Black-Scholes prices and greeks with a simple volatility smile.
 * Options are read-only in this platform (no option trading).
 */
@Component
class OptionChains {

    static final double RATE = 0.03;
    static final int STRIKES_EACH_SIDE = 5;
    /** Days ahead from which the expiries are rolled to the next Friday. */
    static final int[] EXPIRY_DAYS = {7, 30, 60, 120};

    /** At-the-money implied volatility per underlying asset class. */
    private static final Map<AssetClass, Double> BASE_IV = Map.of(
            AssetClass.STOCK, 0.30,
            AssetClass.ETF, 0.17,
            AssetClass.INDEX, 0.16,
            AssetClass.COMMODITY, 0.20,
            AssetClass.CRYPTO, 0.58);

    private final MarketData market;
    private final Clock clock;

    @Autowired
    OptionChains(MarketData market) {
        this(market, Clock.systemUTC());
    }

    OptionChains(MarketData market, Clock clock) {
        this.market = market;
        this.clock = clock;
    }

    OptionChain chain(String symbol, Tenant tenant, LocalDate requestedExpiry) {
        if (!tenant.allows(AssetClass.OPTION)) {
            throw DomainException.forbidden("options-disabled", "Options not offered",
                    tenant.name() + " does not offer options.");
        }
        Instrument underlying = market.require(symbol, tenant);
        if (!underlying.optionable()) {
            throw new DomainException(HttpStatus.NOT_FOUND, "not-found", "No option chain",
                    "There are no listed options on " + underlying.symbol() + ".");
        }
        List<LocalDate> expiries = expiries(LocalDate.now(clock));
        LocalDate expiry = requestedExpiry == null ? expiries.get(1) : requestedExpiry;
        if (!expiries.contains(expiry)) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "validation", "Validation failed",
                    "Unknown expiry " + expiry + "; available: " + expiries + ".",
                    Map.of("errors", Map.of("expiry", "one of " + expiries)));
        }
        double spot = market.mid(underlying.symbol()).doubleValue();
        int days = (int) ChronoUnit.DAYS.between(LocalDate.now(clock), expiry);
        double t = days / 365.0;
        double step = niceStep(spot * 0.025);
        double center = Math.round(spot / step) * step;
        int scale = Math.max(underlying.decimals(), 2);

        List<OptionChain.Row> rows = new ArrayList<>();
        for (int i = -STRIKES_EACH_SIDE; i <= STRIKES_EACH_SIDE; i++) {
            double strike = center + i * step;
            if (strike <= 0) {
                continue;
            }
            double iv = impliedVol(underlying.assetClass(), spot, strike, days);
            var call = OptionPricer.call(spot, strike, t, RATE, iv);
            var put = OptionPricer.put(spot, strike, t, RATE, iv);
            rows.add(new OptionChain.Row(bd(strike, scale), quote(call, iv, spot > strike), quote(put, iv, spot < strike)));
        }
        int contractSize = underlying.assetClass() == AssetClass.STOCK || underlying.assetClass() == AssetClass.ETF ? 100 : 1;
        return new OptionChain(underlying.symbol(), underlying.currency(), market.mid(underlying.symbol()),
                BigDecimal.valueOf(RATE), contractSize, expiries, expiry, days, rows);
    }

    /** Next Friday on or after today + N days, for each N in EXPIRY_DAYS. */
    static List<LocalDate> expiries(LocalDate today) {
        List<LocalDate> result = new ArrayList<>();
        for (int days : EXPIRY_DAYS) {
            result.add(today.plusDays(days).with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY)));
        }
        return result;
    }

    /** Volatility smile: higher IV away from the money, slightly more on the downside (skew), short-dated premium. */
    static double impliedVol(AssetClass assetClass, double spot, double strike, int days) {
        double base = BASE_IV.getOrDefault(assetClass, 0.25);
        double moneyness = Math.log(strike / spot);
        double term = 1 + 0.15 * Math.sqrt(30.0 / Math.max(days, 1)) - 0.15;
        return base * term * (1 + 3.0 * moneyness * moneyness - 0.3 * moneyness);
    }

    /** 1, 2 or 5 × 10^n closest above the raw step: strikes like 225, 230, 235 rather than 228.71. */
    static double niceStep(double raw) {
        double magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
        double normalized = raw / magnitude;
        double nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
        return nice * magnitude;
    }

    private static OptionChain.OptionQuote quote(OptionPricer.Greeks g, double iv, boolean itm) {
        double price = Math.max(g.price(), 0.01);
        double halfSpread = Math.max(0.01, price * 0.02) / 2;
        return new OptionChain.OptionQuote(
                bd(Math.max(price - halfSpread, 0.01), 2), bd(price + halfSpread, 2), bd(price, 2),
                bd(iv * 100, 1), bd(g.delta(), 3), bd(g.gamma(), 5), bd(g.theta(), 3), bd(g.vega(), 3), itm);
    }

    private static BigDecimal bd(double value, int scale) {
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP);
    }
}
