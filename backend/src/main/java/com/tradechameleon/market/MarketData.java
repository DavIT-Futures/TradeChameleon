package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.shared.DomainException;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Public API of the market module. Turns raw mid prices into tenant-specific quotes:
 * {@code spread = market spread(asset class) + broker markup}, split evenly around the mid.
 */
@Service
public class MarketData {

    /** Typical market spread per asset class, in basis points. */
    private static final Map<AssetClass, Integer> MARKET_SPREAD_BPS = Map.of(
            AssetClass.STOCK, 4,
            AssetClass.ETF, 3,
            AssetClass.FX, 1,
            AssetClass.CRYPTO, 15,
            AssetClass.BOND, 5);

    private static final BigDecimal TEN_THOUSAND = BigDecimal.valueOf(10_000);

    private final Map<String, Instrument> instruments = new LinkedHashMap<>();
    private final PriceEngine engine;

    MarketData(InstrumentRepository repository, PriceEngine engine) {
        repository.findAll().forEach(i -> instruments.put(i.symbol(), i));
        this.engine = engine;
    }

    /** Instruments visible to a tenant (filtered by its allowed asset classes). */
    public List<Instrument> instruments(Tenant tenant) {
        return instruments.values().stream().filter(i -> tenant.allows(i.assetClass())).toList();
    }

    public Optional<Instrument> find(String symbol) {
        return Optional.ofNullable(instruments.get(symbol == null ? null : symbol.toUpperCase()));
    }

    /** The instrument if it exists AND the tenant may see it; otherwise 404 (do not leak other brands' lists). */
    public Instrument require(String symbol, Tenant tenant) {
        return find(symbol).filter(i -> tenant.allows(i.assetClass()))
                .orElseThrow(() -> DomainException.notFound("Instrument", symbol));
    }

    public BigDecimal mid(String symbol) {
        return engine.mid(symbol);
    }

    public Quote quote(Instrument instrument, Tenant tenant) {
        return quoteAt(instrument, tenant, engine.mid(instrument.symbol()));
    }

    /** Quote for an arbitrary mid; used by the limit order matcher on every tick. */
    public Quote quoteAt(Instrument instrument, Tenant tenant, BigDecimal mid) {
        int spreadBps = MARKET_SPREAD_BPS.get(instrument.assetClass()) + tenant.spreadMarkupBps();
        BigDecimal half = mid.multiply(BigDecimal.valueOf(spreadBps))
                .divide(TEN_THOUSAND.multiply(BigDecimal.TWO), MathContext.DECIMAL64);
        int scale = instrument.decimals();
        BigDecimal open = engine.open(instrument.symbol());
        BigDecimal change = mid.subtract(open);
        BigDecimal changePct = open.signum() == 0 ? BigDecimal.ZERO
                : change.multiply(BigDecimal.valueOf(100)).divide(open, 2, RoundingMode.HALF_UP);
        return new Quote(
                instrument.symbol(),
                mid.subtract(half).setScale(scale, RoundingMode.DOWN),
                mid.add(half).setScale(scale, RoundingMode.UP),
                mid,
                change.setScale(scale, RoundingMode.HALF_UP),
                changePct,
                engine.lastUpdate(instrument.symbol()));
    }

    List<PriceEngine.PricePoint> history(String symbol, int points) {
        return engine.history(symbol, points);
    }
}
