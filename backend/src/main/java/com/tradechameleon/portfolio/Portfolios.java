package com.tradechameleon.portfolio;

import com.tradechameleon.market.Instrument;
import com.tradechameleon.market.MarketData;
import com.tradechameleon.shared.FxRates;
import com.tradechameleon.shared.OrderFilled;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public API of the portfolio module. Owns cash and positions; nobody else writes them.
 * The trading module only <em>reads</em> holdings (pre-trade checks) and announces fills via events.
 */
@Service
public class Portfolios {

    private static final Logger log = LoggerFactory.getLogger(Portfolios.class);

    /** Starting cash for users that appear for the first time (e.g. from a corporate SSO). */
    private static final Map<String, BigDecimal> STARTING_CASH = Map.of(
            "GBP", new BigDecimal("100000"), "EUR", new BigDecimal("100000"), "USD", new BigDecimal("100000"),
            "PLN", new BigDecimal("400000"), "JPY", new BigDecimal("15000000"));

    private final PortfolioRepository repository;
    private final MarketData market;

    Portfolios(PortfolioRepository repository, MarketData market) {
        this.repository = repository;
        this.market = market;
    }

    /** Cash and quantities, for pre-trade checks. */
    public record Holdings(String currency, BigDecimal cash, Map<String, BigDecimal> quantities) {

        public BigDecimal quantity(String symbol) {
            return quantities.getOrDefault(symbol, BigDecimal.ZERO);
        }
    }

    @Transactional
    public Holdings holdings(Tenant tenant, String userId) {
        var account = account(tenant, userId);
        var quantities = repository.positions(account.id()).stream()
                .collect(Collectors.toMap(PortfolioRepository.PositionRow::symbol,
                        PortfolioRepository.PositionRow::quantity));
        return new Holdings(account.currency(), account.cash(), quantities);
    }

    @Transactional
    public PortfolioView view(Tenant tenant, String userId) {
        var account = account(tenant, userId);
        var rows = repository.positions(account.id());
        BigDecimal positionsValue = BigDecimal.ZERO;
        BigDecimal costBasis = BigDecimal.ZERO;
        var positions = new java.util.ArrayList<PortfolioView.PositionView>();
        for (var row : rows) {
            Instrument instrument = market.find(row.symbol()).orElseThrow();
            BigDecimal last = market.mid(row.symbol());
            BigDecimal value = FxRates.convert(row.quantity().multiply(last), instrument.currency(), account.currency());
            BigDecimal cost = FxRates.convert(row.quantity().multiply(row.avgPrice()), instrument.currency(),
                    account.currency());
            BigDecimal pnl = value.subtract(cost);
            positions.add(new PortfolioView.PositionView(
                    row.symbol(), instrument.name(), instrument.assetClass(), instrument.currency(),
                    row.quantity().stripTrailingZeros(), row.avgPrice().setScale(instrument.decimals(), RoundingMode.HALF_UP),
                    last, money(value), money(pnl), percent(pnl, cost)));
            positionsValue = positionsValue.add(value);
            costBasis = costBasis.add(cost);
        }
        BigDecimal unrealized = positionsValue.subtract(costBasis);
        positions.sort((a, b) -> b.marketValue().compareTo(a.marketValue()));
        return new PortfolioView(account.currency(), money(account.cash()), money(positionsValue),
                money(account.cash().add(positionsValue)), money(unrealized), percent(unrealized, costBasis),
                List.copyOf(positions));
    }

    /**
     * Applies a fill to cash and positions. Runs asynchronously after the trading transaction commits,
     * in its own transaction; Spring Modulith's event publication registry retries it after a crash.
     */
    @ApplicationModuleListener
    void on(OrderFilled fill) {
        var account = repository.lockAccount(fill.tenantId(), fill.userId()).orElseThrow(
                () -> new IllegalStateException("No account for " + fill.userId()));
        BigDecimal cashDelta = FxRates.convert(fill.notional(), fill.currency(), account.currency())
                .multiply(BigDecimal.valueOf(-fill.side().sign()));
        repository.updateCash(account.id(), account.cash().add(cashDelta));

        var current = repository.position(account.id(), fill.symbol())
                .orElse(new PortfolioRepository.PositionRow(fill.symbol(), BigDecimal.ZERO, BigDecimal.ZERO));
        BigDecimal signedQty = fill.quantity().multiply(BigDecimal.valueOf(fill.side().sign()));
        BigDecimal newQty = current.quantity().add(signedQty);
        if (newQty.signum() == 0) {
            repository.deletePosition(account.id(), fill.symbol());
        } else {
            BigDecimal avg = switch (fill.side()) {
                // weighted average cost on buys
                case BUY -> current.quantity().multiply(current.avgPrice()).add(fill.notional())
                        .divide(newQty, MathContext.DECIMAL64);
                // sells realise P&L and keep the average cost of the remaining shares
                case SELL -> current.avgPrice();
            };
            repository.upsertPosition(account.id(), fill.symbol(), newQty, avg);
        }
        log.info("Applied fill {} {} {} @ {} to account {}", fill.side(), fill.quantity(), fill.symbol(),
                fill.price(), account.id());
    }

    private PortfolioRepository.AccountRow account(Tenant tenant, String userId) {
        return repository.findAccount(tenant.id(), userId).orElseGet(() -> {
            repository.createAccountIfMissing(tenant.id(), userId, tenant.currency(),
                    STARTING_CASH.getOrDefault(tenant.currency(), new BigDecimal("100000")));
            return repository.findAccount(tenant.id(), userId).orElseThrow();
        });
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal percent(BigDecimal part, BigDecimal whole) {
        return whole.signum() == 0 ? BigDecimal.ZERO
                : part.multiply(BigDecimal.valueOf(100)).divide(whole, 2, RoundingMode.HALF_UP);
    }
}
