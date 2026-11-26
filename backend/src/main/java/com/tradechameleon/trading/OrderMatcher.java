package com.tradechameleon.trading;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.market.PricesTicked;
import com.tradechameleon.market.Quote;
import com.tradechameleon.shared.Side;
import com.tradechameleon.tenant.TenantDirectory;
import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Works through every OPEN order on each price tick, using the tenant's own bid/ask:
 * <ul>
 *   <li>LIMIT (and a triggered STOP_LIMIT): BUY fills when ask &le; limit, SELL when bid &ge; limit.</li>
 *   <li>STOP: BUY triggers when ask &ge; stop, SELL when bid &le; stop, and fills at once at the market.</li>
 *   <li>STOP_LIMIT: same trigger, but then rests as a limit order.</li>
 * </ul>
 * Fills execute at the current quote, so price improvement goes to the client.
 */
@Component
class OrderMatcher {

    private static final Logger log = LoggerFactory.getLogger(OrderMatcher.class);

    private final OrderRepository orders;
    private final OrderService service;
    private final MarketData market;
    private final TenantDirectory tenants;

    OrderMatcher(OrderRepository orders, OrderService service, MarketData market, TenantDirectory tenants) {
        this.orders = orders;
        this.service = service;
        this.market = market;
        this.tenants = tenants;
    }

    @EventListener
    void on(PricesTicked tick) {
        Map<String, BigDecimal> mids = tick.ticks().stream()
                .collect(Collectors.toMap(PricesTicked.Tick::symbol, PricesTicked.Tick::mid));
        for (Order order : orders.findOpen(mids.keySet())) {
            try {
                process(order, mids.get(order.symbol()));
            } catch (RuntimeException e) {
                log.warn("Could not process order {}", order.id(), e);
            }
        }
    }

    private void process(Order order, BigDecimal mid) {
        var tenant = tenants.get(order.tenantId());
        var instrument = market.find(order.symbol()).orElseThrow();
        Quote quote = market.quoteAt(instrument, tenant, mid);
        BigDecimal executable = order.side() == Side.BUY ? quote.ask() : quote.bid();

        boolean limitActive = order.type() == Order.OrderType.LIMIT
                || (order.type() == Order.OrderType.STOP_LIMIT && order.triggered());
        if (limitActive) {
            if (limitCrossed(order.side(), executable, order.limitPrice())) {
                service.fillPending(order, instrument, tenant, executable);
                log.info("{} order {} {} {} filled at {}", order.type(), order.id(), order.side(), order.symbol(), executable);
            }
            return;
        }
        if (stopReached(order.side(), executable, order.stopPrice())) {
            if (order.type() == Order.OrderType.STOP) {
                service.fillPending(order, instrument, tenant, executable);
                log.info("STOP order {} {} {} triggered and filled at {}", order.id(), order.side(), order.symbol(), executable);
            } else if (service.trigger(order) && limitCrossed(order.side(), executable, order.limitPrice())) {
                service.fillPending(order, instrument, tenant, executable);
            }
        }
    }

    static boolean limitCrossed(Side side, BigDecimal executable, BigDecimal limit) {
        return side == Side.BUY ? executable.compareTo(limit) <= 0 : executable.compareTo(limit) >= 0;
    }

    static boolean stopReached(Side side, BigDecimal executable, BigDecimal stop) {
        return side == Side.BUY ? executable.compareTo(stop) >= 0 : executable.compareTo(stop) <= 0;
    }
}
