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
 * Order lifecycle. Market orders fill immediately at the tenant's ask (buy) or bid (sell). Limit orders
 * rest as OPEN until {@link LimitOrderMatcher} sees a crossing price.
 *
 * <p>The trading module never touches cash or positions. It publishes {@link OrderFilled} inside its
 * transaction; the portfolio module applies it after commit.
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
        if (request.type() == Order.OrderType.LIMIT && !tenant.features().limitOrders()) {
            throw DomainException.forbidden("limit-orders-disabled", "Limit orders disabled",
                    tenant.name() + " only supports market orders.");
        }
        if (request.type() == Order.OrderType.LIMIT && request.limitPrice() == null) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "validation", "Validation failed",
                    "limitPrice is required for LIMIT orders.", Map.of("errors", Map.of("limitPrice", "required")));
        }
        Instrument instrument = market.require(request.symbol(), tenant);
        Quote quote = market.quote(instrument, tenant);
        BigDecimal quantity = request.quantity();
        BigDecimal referencePrice = switch (request.type()) {
            case MARKET -> request.side() == Side.BUY ? quote.ask() : quote.bid();
            case LIMIT -> request.limitPrice().setScale(instrument.decimals(), RoundingMode.HALF_UP);
        };
        checkHoldings(tenant, userId, instrument, request.side(), quantity, referencePrice);

        Instant now = Instant.now();
        var order = new Order(UUID.randomUUID(), tenant.id(), userId, instrument.symbol(), request.side(),
                request.type(), quantity, request.type() == Order.OrderType.LIMIT ? referencePrice : null,
                Order.OrderStatus.OPEN, null, null, now, now);

        if (request.type() == Order.OrderType.MARKET) {
            order = order.filled(referencePrice, now);
            orders.insert(order);
            events.publishEvent(fillEvent(order, instrument));
        } else {
            orders.insert(order);
        }
        return order;
    }

    /**
     * Fills a resting limit order at {@code price}. Re-checks holdings because cash may have been spent
     * since the order was placed. Called by the matcher, one short transaction per fill.
     */
    @Transactional
    public void fillLimitOrder(Order order, Instrument instrument, Tenant tenant, BigDecimal price) {
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
    public Order cancel(Tenant tenant, String userId, UUID id) {
        var order = get(tenant, userId, id);
        if (order.status() != Order.OrderStatus.OPEN || !orders.transitionFromOpen(id, Order.OrderStatus.CANCELLED,
                null, null)) {
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

    private static OrderFilled fillEvent(Order order, Instrument instrument) {
        return new OrderFilled(order.id(), order.tenantId(), order.userId(), order.symbol(), order.side(),
                order.quantity(), order.fillPrice(), instrument.currency(), order.updatedAt());
    }
}
