package com.tradechameleon.trading;

import com.tradechameleon.market.Instrument;
import com.tradechameleon.market.MarketData;
import com.tradechameleon.market.Quote;
import com.tradechameleon.portfolio.Portfolios;
import com.tradechameleon.shared.DomainException;
import com.tradechameleon.shared.FxRates;
import com.tradechameleon.shared.OrderFilled;
import com.tradechameleon.shared.Side;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Order lifecycle.
 * <ul>
 *   <li>MARKET fills immediately at the tenant's ask (buy) or bid (sell).</li>
 *   <li>LIMIT, STOP and STOP_LIMIT rest as OPEN; {@link OrderMatcher} fills or triggers them on price ticks.</li>
 *   <li>A BUY may carry stopLoss/takeProfit; the portfolio attaches them to the position when it fills and
 *       {@link ProtectionMonitor} closes the position when one of them is hit.</li>
 * </ul>
 * The trading module never touches cash or positions: it publishes {@link OrderFilled} inside its
 * transaction and the portfolio module applies it after commit.
 */
@Service
public class OrderService {

    private final OrderRepository orders;
    private final MarketData market;
    private final Portfolios portfolios;
    private final ApplicationEventPublisher events;

    OrderService(OrderRepository orders, MarketData market, Portfolios portfolios, ApplicationEventPublisher events) {
        this.orders = orders;
        this.market = market;
        this.portfolios = portfolios;
        this.events = events;
    }

    @Transactional
    public Order place(Tenant tenant, String userId, PlaceOrderRequest request) {
        if (!tenant.features().trading()) {
            throw DomainException.forbidden("trading-disabled", "Trading disabled",
                    tenant.name() + " is a portfolio-only broker: orders are not accepted.");
        }
        var type = request.type();
        if (type != Order.OrderType.MARKET && !tenant.features().limitOrders()) {
            throw DomainException.forbidden("limit-orders-disabled", "Pending orders disabled",
                    tenant.name() + " only supports market orders (no LIMIT, STOP or STOP_LIMIT).");
        }
        requirePrice(type == Order.OrderType.LIMIT || type == Order.OrderType.STOP_LIMIT, request.limitPrice(), "limitPrice", type);
        requirePrice(type == Order.OrderType.STOP || type == Order.OrderType.STOP_LIMIT, request.stopPrice(), "stopPrice", type);

        Instrument instrument = market.require(request.symbol(), tenant);
        Quote quote = market.quote(instrument, tenant);
        int scale = instrument.decimals();
        BigDecimal limit = scaled(request.limitPrice(), scale);
        BigDecimal stop = scaled(request.stopPrice(), scale);
        Side side = request.side();

        if (stop != null) {
            boolean valid = side == Side.BUY ? stop.compareTo(quote.ask()) > 0 : stop.compareTo(quote.bid()) < 0;
            if (!valid) {
                throw DomainException.unprocessable("invalid-stop", "Invalid stop price",
                        side == Side.BUY
                                ? "A BUY stop must be above the current ask (" + quote.ask() + ")."
                                : "A SELL stop must be below the current bid (" + quote.bid() + ").",
                        Map.of("bid", quote.bid(), "ask", quote.ask()));
            }
        }

        // the price the order is expected to execute at: used for funds checks and SL/TP sanity
        BigDecimal entry = switch (type) {
            case MARKET -> side == Side.BUY ? quote.ask() : quote.bid();
            case LIMIT, STOP_LIMIT -> limit;
            case STOP -> stop;
        };
        BigDecimal stopLoss = scaled(request.stopLoss(), scale);
        BigDecimal takeProfit = scaled(request.takeProfit(), scale);
        validateProtection(side, entry, stopLoss, takeProfit);
        checkHoldings(tenant, userId, instrument, side, request.quantity(), entry);
        checkLimits(tenant, userId, instrument, type, request.quantity(), entry);

        Instant now = Instant.now();
        var order = new Order(UUID.randomUUID(), tenant.id(), userId, instrument.symbol(), side, type,
                request.quantity(), limit, stop, stopLoss, takeProfit, Order.OrderStatus.OPEN, false,
                Order.Origin.CLIENT, null, null, now, now);

        if (type == Order.OrderType.MARKET) {
            order = order.filled(entry, now);
            orders.insert(order);
            events.publishEvent(fillEvent(order, instrument));
        } else {
            orders.insert(order);
        }
        return order;
    }

    /**
     * Closes a whole position with a market SELL generated by a stop-loss or take-profit.
     * Runs in the caller's transaction together with clearing the protection, so it cannot fire twice.
     */
    @Transactional
    public java.util.Optional<Order> closeByProtection(Tenant tenant, String userId, Instrument instrument,
                                                       BigDecimal quantity, BigDecimal bid, Order.Origin origin) {
        // compare-and-set: only the first tick that sees the trigger wins
        if (!portfolios.clearProtection(tenant, userId, instrument.symbol())) {
            return java.util.Optional.empty();
        }
        Instant now = Instant.now();
        var order = new Order(UUID.randomUUID(), tenant.id(), userId, instrument.symbol(), Side.SELL,
                Order.OrderType.MARKET, quantity, null, null, null, null, Order.OrderStatus.FILLED, false, origin,
                bid, null, now, now);
        orders.insert(order);
        events.publishEvent(fillEvent(order, instrument));
        return java.util.Optional.of(order);
    }

    /**
     * Fills a resting order at {@code price}. Re-checks holdings because cash may have been spent since
     * the order was placed. Called by the matcher, one short transaction per fill.
     */
    @Transactional
    public void fillPending(Order order, Instrument instrument, Tenant tenant, BigDecimal price) {
        try {
            checkHoldings(tenant, order.userId(), instrument, order.side(), order.quantity(), price);
        } catch (DomainException e) {
            orders.transitionFromOpen(order.id(), Order.OrderStatus.REJECTED, null, e.getMessage());
            return;
        }
        if (orders.transitionFromOpen(order.id(), Order.OrderStatus.FILLED, price, null)) {
            events.publishEvent(fillEvent(order.filled(price, Instant.now()), instrument));
        }
    }

    @Transactional
    public boolean trigger(Order order) {
        return orders.markTriggered(order.id());
    }

    @Transactional
    public Order cancel(Tenant tenant, String userId, UUID id) {
        var order = get(tenant, userId, id);
        if (order.status() != Order.OrderStatus.OPEN
                || !orders.transitionFromOpen(id, Order.OrderStatus.CANCELLED, null, null)) {
            throw new DomainException(HttpStatus.CONFLICT, "order-not-open", "Order is not open",
                    "Only OPEN orders can be cancelled; this one is " + order.status() + ".");
        }
        return get(tenant, userId, id);
    }

    public Order get(Tenant tenant, String userId, UUID id) {
        return orders.find(tenant.id(), userId, id).orElseThrow(() -> DomainException.notFound("Order", id.toString()));
    }

    public List<Order> list(Tenant tenant, String userId, Order.OrderStatus status, int limit) {
        return orders.findForUser(tenant.id(), userId, status, limit);
    }

    // ---- validation helpers -------------------------------------------------------------------

    private static void requirePrice(boolean required, BigDecimal value, String field, Order.OrderType type) {
        if (required && value == null) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "validation", "Validation failed",
                    field + " is required for " + type + " orders.", Map.of("errors", Map.of(field, "required")));
        }
    }

    /** SL/TP protect long positions: stop-loss below the entry, take-profit above it. */
    static void validateProtection(Side side, BigDecimal entry, BigDecimal stopLoss, BigDecimal takeProfit) {
        if (stopLoss == null && takeProfit == null) {
            return;
        }
        if (side == Side.SELL) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "validation", "Validation failed",
                    "Stop-loss and take-profit can only be attached to BUY orders (short selling is not supported).",
                    Map.of("errors", Map.of("stopLoss", "BUY only")));
        }
        if (stopLoss != null && stopLoss.compareTo(entry) >= 0) {
            throw DomainException.unprocessable("invalid-protection", "Invalid stop-loss",
                    "The stop-loss (" + stopLoss + ") must be below the entry price (" + entry + ").",
                    Map.of("entry", entry));
        }
        if (takeProfit != null && takeProfit.compareTo(entry) <= 0) {
            throw DomainException.unprocessable("invalid-protection", "Invalid take-profit",
                    "The take-profit (" + takeProfit + ") must be above the entry price (" + entry + ").",
                    Map.of("entry", entry));
        }
    }

    private void checkHoldings(Tenant tenant, String userId, Instrument instrument, Side side, BigDecimal quantity,
                               BigDecimal price) {
        var holdings = portfolios.holdings(tenant, userId);
        if (side == Side.BUY) {
            BigDecimal cost = FxRates.convert(quantity.multiply(price), instrument.currency(), holdings.currency());
            if (cost.compareTo(holdings.cash()) > 0) {
                throw DomainException.unprocessable("insufficient-funds", "Insufficient funds",
                        "Buying " + quantity.toPlainString() + " " + instrument.symbol() + " costs "
                                + cost.setScale(2, RoundingMode.HALF_UP) + " " + holdings.currency()
                                + " but only " + holdings.cash().setScale(2, RoundingMode.HALF_UP) + " is available.",
                        Map.of("required", cost.setScale(2, RoundingMode.HALF_UP),
                                "available", holdings.cash().setScale(2, RoundingMode.HALF_UP),
                                "currency", holdings.currency()));
            }
        } else if (holdings.quantity(instrument.symbol()).compareTo(quantity) < 0) {
            throw DomainException.unprocessable("insufficient-position", "Insufficient position",
                    "You hold " + holdings.quantity(instrument.symbol()).stripTrailingZeros().toPlainString() + " "
                            + instrument.symbol() + "; short selling is not supported.",
                    Map.of("held", holdings.quantity(instrument.symbol()).stripTrailingZeros()));
        }
    }

    /** Broker-specific limits: maximum order value and maximum number of pending orders. */
    private void checkLimits(Tenant tenant, String userId, Instrument instrument, Order.OrderType type,
                             BigDecimal quantity, BigDecimal price) {
        var limits = tenant.limits();
        if (limits.maxOrderValue() != null) {
            BigDecimal value = FxRates.convert(quantity.multiply(price), instrument.currency(), tenant.currency());
            if (value.compareTo(limits.maxOrderValue()) > 0) {
                throw DomainException.unprocessable("order-limit-exceeded", "Order value limit exceeded",
                        "This order is worth " + value.setScale(2, RoundingMode.HALF_UP) + " " + tenant.currency() + "; "
                                + tenant.name() + " accepts at most " + limits.maxOrderValue() + " " + tenant.currency()
                                + " per order.",
                        Map.of("maxOrderValue", limits.maxOrderValue(), "orderValue", value.setScale(2, RoundingMode.HALF_UP),
                                "currency", tenant.currency()));
            }
        }
        if (type != Order.OrderType.MARKET && limits.maxOpenOrders() != null) {
            int open = orders.countOpen(tenant.id(), userId);
            if (open >= limits.maxOpenOrders()) {
                throw DomainException.unprocessable("open-orders-limit", "Too many pending orders",
                        tenant.name() + " allows at most " + limits.maxOpenOrders() + " pending orders; you have " + open + ".",
                        Map.of("maxOpenOrders", limits.maxOpenOrders(), "openOrders", open));
            }
        }
    }

    private static BigDecimal scaled(BigDecimal value, int scale) {
        return value == null ? null : value.setScale(scale, RoundingMode.HALF_UP);
    }

    private static OrderFilled fillEvent(Order order, Instrument instrument) {
        return new OrderFilled(order.id(), order.tenantId(), order.userId(), order.symbol(), order.side(),
                order.quantity(), order.fillPrice(), instrument.currency(), order.updatedAt(),
                order.stopLoss(), order.takeProfit(), order.origin().name());
    }
}
