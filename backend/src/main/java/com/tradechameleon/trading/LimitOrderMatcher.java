package com.tradechameleon.trading;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.market.PricesTicked;
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
 * Listens to every price tick and fills resting limit orders whose price has been reached:
 * a BUY fills when the tenant's ask drops to the limit or below, a SELL when the bid rises to it or above.
 * Fills execute at the current quote (price improvement goes to the client).
 */
@Component
class LimitOrderMatcher {

    private static final Logger log = LoggerFactory.getLogger(LimitOrderMatcher.class);

    private final OrderRepository orders;
    private final OrderService service;
    private final MarketData market;
    private final TenantDirectory tenants;

    LimitOrderMatcher(OrderRepository orders, OrderService service, MarketData market, TenantDirectory tenants) {
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
            var tenant = tenants.get(order.tenantId());
            var instrument = market.find(order.symbol()).orElseThrow();
            var quote = market.quoteAt(instrument, tenant, mids.get(order.symbol()));
            boolean crosses = order.side() == Side.BUY
                    ? quote.ask().compareTo(order.limitPrice()) <= 0
                    : quote.bid().compareTo(order.limitPrice()) >= 0;
            if (crosses) {
                BigDecimal price = order.side() == Side.BUY ? quote.ask() : quote.bid();
                try {
                    service.fillLimitOrder(order, instrument, tenant, price);
                    log.info("Limit order {} {} {} filled at {}", order.id(), order.side(), order.symbol(), price);
                } catch (RuntimeException e) {
                    log.warn("Could not fill limit order {}", order.id(), e);
                }
            }
        }
    }
}
