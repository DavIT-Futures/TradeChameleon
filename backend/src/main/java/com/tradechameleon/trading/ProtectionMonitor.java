package com.tradechameleon.trading;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.market.PricesTicked;
import com.tradechameleon.portfolio.Portfolios;
import com.tradechameleon.tenant.TenantDirectory;
import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Stop-loss / take-profit engine. On every tick it looks at positions that carry protection and closes
 * the whole position with a market SELL when the tenant's bid reaches the stop-loss (bid &le; SL) or the
 * take-profit (bid &ge; TP).
 */
@Component
class ProtectionMonitor {

    private static final Logger log = LoggerFactory.getLogger(ProtectionMonitor.class);

    private final Portfolios portfolios;
    private final OrderService orders;
    private final MarketData market;
    private final TenantDirectory tenants;

    ProtectionMonitor(Portfolios portfolios, OrderService orders, MarketData market, TenantDirectory tenants) {
        this.portfolios = portfolios;
        this.orders = orders;
        this.market = market;
        this.tenants = tenants;
    }

    @EventListener
    void on(PricesTicked tick) {
        Map<String, BigDecimal> mids = tick.ticks().stream()
                .collect(Collectors.toMap(PricesTicked.Tick::symbol, PricesTicked.Tick::mid));
        for (var position : portfolios.protectedPositions(mids.keySet())) {
            try {
                var tenant = tenants.get(position.tenantId());
                if (!tenant.features().trading()) {
                    continue;
                }
                var instrument = market.find(position.symbol()).orElseThrow();
                BigDecimal bid = market.quoteAt(instrument, tenant, mids.get(position.symbol())).bid();
                Order.Origin origin = null;
                if (position.stopLoss() != null && bid.compareTo(position.stopLoss()) <= 0) {
                    origin = Order.Origin.STOP_LOSS;
                } else if (position.takeProfit() != null && bid.compareTo(position.takeProfit()) >= 0) {
                    origin = Order.Origin.TAKE_PROFIT;
                }
                if (origin != null) {
                    var closed = orders.closeByProtection(tenant, position.userId(), instrument, position.quantity(), bid, origin);
                    if (closed.isPresent()) {
                        log.info("{} closed {} {} at {}", origin, position.quantity(), position.symbol(), bid);
                    }
                }
            } catch (RuntimeException e) {
                log.warn("Protection check failed for {}", position, e);
            }
        }
    }
}
