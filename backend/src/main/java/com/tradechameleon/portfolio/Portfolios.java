package com.tradechameleon.portfolio;

import com.tradechameleon.market.Instrument;
import com.tradechameleon.market.MarketData;
import com.tradechameleon.shared.DomainException;
import com.tradechameleon.shared.FxRates;
import com.tradechameleon.shared.OrderFilled;
import com.tradechameleon.shared.Side;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public API of the portfolio module. Owns cash, positions, the cash ledger and realised P&amp;L;
 * nobody else writes them. The trading module only reads holdings / protected positions and
 * announces fills via events.
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

    /** A position with stop-loss and/or take-profit, for the protection engine. */
    public record ProtectedPosition(String tenantId, String userId, String symbol, BigDecimal quantity,
                                    BigDecimal stopLoss, BigDecimal takeProfit) {
    }

    @Transactional
    public Holdings holdings(Tenant tenant, String userId) {
        var account = account(tenant, userId);
        var quantities = repository.positions(account.id()).stream()
                .collect(Collectors.toMap(PortfolioRepository.PositionRow::symbol,
                        PortfolioRepository.PositionRow::quantity));
        return new Holdings(account.currency(), account.cash(), quantities);
    }

    public List<ProtectedPosition> protectedPositions(Collection<String> symbols) {
        return repository.protectedPositions(symbols).stream()
                .map(r -> new ProtectedPosition(r.tenantId(), r.userId(), r.symbol(), r.quantity(), r.stopLoss(),
                        r.takeProfit()))
                .toList();
    }

    /** Removes SL/TP; returns true only for the caller that actually removed it (no double close). */
    @Transactional
    public boolean clearProtection(Tenant tenant, String userId, String symbol) {
        return repository.clearProtection(tenant.id(), userId, symbol);
    }

    @Transactional
    public PortfolioView view(Tenant tenant, String userId) {
        var account = account(tenant, userId);
        var rows = repository.positions(account.id());
        BigDecimal positionsValue = BigDecimal.ZERO;
        BigDecimal costBasis = BigDecimal.ZERO;
        var positions = new ArrayList<PortfolioView.PositionView>();
        for (var row : rows) {
            Instrument instrument = market.find(row.symbol()).orElseThrow();
            BigDecimal last = market.mid(row.symbol());
            BigDecimal value = FxRates.convert(row.quantity().multiply(last), instrument.currency(), account.currency());
            BigDecimal cost = FxRates.convert(row.quantity().multiply(row.avgPrice()), instrument.currency(),
                    account.currency());
            BigDecimal pnl = value.subtract(cost);
            positions.add(new PortfolioView.PositionView(
                    row.symbol(), instrument.name(), instrument.assetClass(), instrument.currency(), instrument.decimals(),
                    row.quantity().stripTrailingZeros(), row.avgPrice().setScale(instrument.decimals(), RoundingMode.HALF_UP),
                    last, money(value), money(pnl), percent(pnl, cost),
                    scaled(row.stopLoss(), instrument.decimals()), scaled(row.takeProfit(), instrument.decimals())));
            positionsValue = positionsValue.add(value);
            costBasis = costBasis.add(cost);
        }
        BigDecimal unrealized = positionsValue.subtract(costBasis);
        positions.sort((a, b) -> b.marketValue().compareTo(a.marketValue()));
        return new PortfolioView(account.currency(), money(account.cash()), money(positionsValue),
                money(account.cash().add(positionsValue)), money(unrealized), percent(unrealized, costBasis),
                money(repository.realizedTotal(account.id())), List.copyOf(positions));
    }

    // ---- account operations ------------------------------------------------------------------

    @Transactional
    public CashTransaction deposit(Tenant tenant, String userId, BigDecimal amount) {
        account(tenant, userId);
        var account = repository.lockAccount(tenant.id(), userId).orElseThrow();
        BigDecimal balance = account.cash().add(amount);
        repository.updateCash(account.id(), balance);
        repository.insertTransaction(account.id(), CashTransaction.Type.DEPOSIT, amount, balance, null,
                "Deposit", Instant.now());
        return repository.transactions(account.id(), 1).getFirst();
    }

    @Transactional
    public CashTransaction withdraw(Tenant tenant, String userId, BigDecimal amount) {
        account(tenant, userId);
        var account = repository.lockAccount(tenant.id(), userId).orElseThrow();
        if (amount.compareTo(account.cash()) > 0) {
            throw DomainException.unprocessable("insufficient-funds", "Insufficient funds",
                    "You can withdraw at most " + money(account.cash()) + " " + account.currency() + ".",
                    Map.of("available", money(account.cash()), "currency", account.currency()));
        }
        BigDecimal balance = account.cash().subtract(amount);
        repository.updateCash(account.id(), balance);
        repository.insertTransaction(account.id(), CashTransaction.Type.WITHDRAWAL, amount.negate(), balance, null,
                "Withdrawal", Instant.now());
        return repository.transactions(account.id(), 1).getFirst();
    }

    @Transactional
    public List<CashTransaction> transactions(Tenant tenant, String userId, int limit) {
        return repository.transactions(account(tenant, userId).id(), limit);
    }

    @Transactional
    public List<ClosedTrade> closedTrades(Tenant tenant, String userId, int limit) {
        return repository.closedTrades(account(tenant, userId).id(), limit);
    }

    /** Sets or removes (null) stop-loss and take-profit on an open position. */
    @Transactional
    public PortfolioView protect(Tenant tenant, String userId, String symbol, BigDecimal stopLoss, BigDecimal takeProfit) {
        var account = account(tenant, userId);
        Instrument instrument = market.require(symbol, tenant);
        repository.position(account.id(), instrument.symbol())
                .orElseThrow(() -> DomainException.notFound("Position", instrument.symbol()));
        BigDecimal bid = market.quote(instrument, tenant).bid();
        if (stopLoss != null && stopLoss.compareTo(bid) >= 0) {
            throw DomainException.unprocessable("invalid-protection", "Invalid stop-loss",
                    "The stop-loss must be below the current bid (" + bid + ").", Map.of("bid", bid));
        }
        if (takeProfit != null && takeProfit.compareTo(bid) <= 0) {
            throw DomainException.unprocessable("invalid-protection", "Invalid take-profit",
                    "The take-profit must be above the current bid (" + bid + ").", Map.of("bid", bid));
        }
        repository.setProtection(account.id(), instrument.symbol(), scaled(stopLoss, instrument.decimals()),
                scaled(takeProfit, instrument.decimals()));
        return view(tenant, userId);
    }

    // ---- fills -----------------------------------------------------------------------------------

    /**
     * Applies a fill to cash, positions, the ledger and realised P&amp;L. Runs asynchronously after the
     * trading transaction commits, in its own transaction; Spring Modulith's event publication registry
     * retries it after a crash.
     */
    @ApplicationModuleListener
    void on(OrderFilled fill) {
        var account = repository.lockAccount(fill.tenantId(), fill.userId()).orElseThrow(
                () -> new IllegalStateException("No account for " + fill.userId()));
        BigDecimal notional = FxRates.convert(fill.notional(), fill.currency(), account.currency());
        BigDecimal cashDelta = notional.multiply(BigDecimal.valueOf(-fill.side().sign()));
        BigDecimal balance = account.cash().add(cashDelta);
        repository.updateCash(account.id(), balance);

        String what = fill.side() + " " + fill.quantity().stripTrailingZeros().toPlainString() + " " + fill.symbol()
                + " @ " + fill.price().toPlainString() + " " + fill.currency()
                + ("CLIENT".equals(fill.reason()) ? "" : " (" + fill.reason().replace('_', ' ').toLowerCase() + ")");
        repository.insertTransaction(account.id(),
                fill.side() == Side.BUY ? CashTransaction.Type.BUY : CashTransaction.Type.SELL,
                cashDelta, balance, fill.orderId(), what, fill.filledAt());

        var current = repository.position(account.id(), fill.symbol())
                .orElse(new PortfolioRepository.PositionRow(fill.symbol(), BigDecimal.ZERO, BigDecimal.ZERO, null, null));
        BigDecimal signedQty = fill.quantity().multiply(BigDecimal.valueOf(fill.side().sign()));
        BigDecimal newQty = current.quantity().add(signedQty);

        if (fill.side() == Side.SELL && current.quantity().signum() > 0) {
            BigDecimal pnl = FxRates.convert(fill.price().subtract(current.avgPrice()).multiply(fill.quantity()),
                    fill.currency(), account.currency());
            repository.insertClosedTrade(account.id(), fill.orderId(), fill.symbol(), fill.quantity(),
                    current.avgPrice(), fill.price(), fill.currency(), pnl, fill.filledAt());
        }

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
            if (fill.side() == Side.BUY && (fill.stopLoss() != null || fill.takeProfit() != null)) {
                repository.setProtection(account.id(), fill.symbol(),
                        fill.stopLoss() != null ? fill.stopLoss() : current.stopLoss(),
                        fill.takeProfit() != null ? fill.takeProfit() : current.takeProfit());
            }
        }
        log.info("Applied fill {} to account {}", what, account.id());
    }

    private PortfolioRepository.AccountRow account(Tenant tenant, String userId) {
        return repository.findAccount(tenant.id(), userId).orElseGet(() -> {
            BigDecimal cash = STARTING_CASH.getOrDefault(tenant.currency(), new BigDecimal("100000"));
            UUID id = UUID.randomUUID();
            if (repository.createAccountIfMissing(id, tenant.id(), userId, tenant.currency(), cash)) {
                repository.insertTransaction(id, CashTransaction.Type.DEPOSIT, cash, cash, null, "Opening deposit",
                        Instant.now());
            }
            return repository.findAccount(tenant.id(), userId).orElseThrow();
        });
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scaled(BigDecimal v, int scale) {
        return v == null ? null : v.setScale(scale, RoundingMode.HALF_UP);
    }

    private static BigDecimal percent(BigDecimal part, BigDecimal whole) {
        return whole.signum() == 0 ? BigDecimal.ZERO
                : part.multiply(BigDecimal.valueOf(100)).divide(whole, 2, RoundingMode.HALF_UP);
    }
}
