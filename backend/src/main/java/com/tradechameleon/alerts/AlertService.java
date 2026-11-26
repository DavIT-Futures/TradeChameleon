package com.tradechameleon.alerts;

import com.tradechameleon.market.MarketData;
import com.tradechameleon.market.PricesTicked;
import com.tradechameleon.shared.DomainException;
import com.tradechameleon.tenant.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Price alerts: create, list, cancel, and fire them from the price ticks. */
@Service
class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertRepository alerts;
    private final MarketData market;
    private final ApplicationEventPublisher events;

    AlertService(AlertRepository alerts, MarketData market, ApplicationEventPublisher events) {
        this.alerts = alerts;
        this.market = market;
        this.events = events;
    }

    @Transactional
    PriceAlert create(Tenant tenant, String userId, String symbol, PriceAlert.Condition condition, BigDecimal price,
                      String note) {
        var instrument = market.require(symbol, tenant);
        BigDecimal mid = market.mid(instrument.symbol());
        var alert = new PriceAlert(UUID.randomUUID(), instrument.symbol(), condition,
                price.setScale(instrument.decimals(), RoundingMode.HALF_UP), note, PriceAlert.Status.ACTIVE, false,
                Instant.now(), null, null);
        if (alert.isMetBy(mid)) {
            throw DomainException.unprocessable("alert-already-met", "Alert condition already met",
                    instrument.symbol() + " is at " + mid + ": an alert " + condition + " " + alert.price()
                            + " would fire immediately.", Map.of("mid", mid));
        }
        alerts.insert(tenant.id(), userId, alert);
        return alert;
    }

    List<PriceAlert> list(Tenant tenant, String userId, PriceAlert.Status status) {
        return alerts.findForUser(tenant.id(), userId, status);
    }

    List<PriceAlert> notifications(Tenant tenant, String userId) {
        return alerts.unacknowledged(tenant.id(), userId);
    }

    @Transactional
    PriceAlert cancel(Tenant tenant, String userId, UUID id) {
        var alert = alerts.find(tenant.id(), userId, id).orElseThrow(() -> DomainException.notFound("Alert", id.toString()));
        if (!alerts.cancel(alert.id())) {
            throw new DomainException(HttpStatus.CONFLICT, "alert-not-active", "Alert is not active",
                    "Only ACTIVE alerts can be cancelled; this one is " + alert.status() + ".");
        }
        return alerts.find(tenant.id(), userId, id).orElseThrow();
    }

    void acknowledge(Tenant tenant, String userId, UUID id) {
        alerts.acknowledge(tenant.id(), userId, id);
    }

    /** Fires alerts on the mid price: the same price for every broker, so alerts are spread-independent. */
    @EventListener
    void on(PricesTicked tick) {
        Map<String, BigDecimal> mids = tick.ticks().stream()
                .collect(Collectors.toMap(PricesTicked.Tick::symbol, PricesTicked.Tick::mid));
        for (var active : alerts.active(mids.keySet())) {
            BigDecimal mid = mids.get(active.alert().symbol());
            if (active.alert().isMetBy(mid) && alerts.trigger(active.alert().id(), mid, tick.at())) {
                log.info("Alert {} {} {} {} fired at {}", active.alert().id(), active.alert().symbol(),
                        active.alert().condition(), active.alert().price(), mid);
                events.publishEvent(new AlertTriggered(active.alert().id(), active.tenantId(), active.userId(),
                        active.alert().symbol(), mid, tick.at()));
            }
        }
    }
}
