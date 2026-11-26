package com.tradechameleon.market;

import com.tradechameleon.tenant.Tenant;
import com.tradechameleon.tenant.TenantDirectory;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Server-Sent Events fan-out. Subscribers are grouped per tenant because every broker sees its own
 * instruments and its own bid/ask. On each {@link PricesTicked} the quotes are computed once per tenant
 * and pushed to all its subscribers; each send happens on its own virtual thread so one slow client
 * cannot delay the others.
 */
@Component
class PriceStream {

    private static final Logger log = LoggerFactory.getLogger(PriceStream.class);
    static final Duration TIMEOUT = Duration.ofMinutes(30);

    private final Map<String, List<SseEmitter>> subscribers = new ConcurrentHashMap<>();
    private final ExecutorService senders = Executors.newVirtualThreadPerTaskExecutor();
    private final MarketData market;
    private final TenantDirectory tenants;

    PriceStream(MarketData market, TenantDirectory tenants) {
        this.market = market;
        this.tenants = tenants;
    }

    SseEmitter subscribe(Tenant tenant) {
        var emitter = new SseEmitter(TIMEOUT.toMillis());
        var list = subscribers.computeIfAbsent(tenant.id(), id -> new CopyOnWriteArrayList<>());
        list.add(emitter);
        Runnable remove = () -> list.remove(emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        // Initial snapshot so the client renders immediately instead of waiting for the next tick.
        send(emitter, snapshot(tenant), list);
        return emitter;
    }

    @EventListener
    void on(PricesTicked tick) {
        subscribers.forEach((tenantId, emitters) -> {
            if (emitters.isEmpty()) {
                return;
            }
            Tenant tenant = tenants.get(tenantId);
            if (!tenant.features().livePrices()) {
                return;
            }
            List<Quote> quotes = snapshot(tenant);
            for (SseEmitter emitter : emitters) {
                senders.submit(() -> send(emitter, quotes, emitters));
            }
        });
    }

    private List<Quote> snapshot(Tenant tenant) {
        return market.instruments(tenant).stream().map(i -> market.quote(i, tenant)).toList();
    }

    private void send(SseEmitter emitter, List<Quote> quotes, List<SseEmitter> group) {
        try {
            emitter.send(SseEmitter.event()
                    .name("quotes")
                    .id(String.valueOf(System.currentTimeMillis()))
                    .data(quotes, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            group.remove(emitter);
            log.debug("SSE subscriber dropped: {}", e.getMessage());
        }
    }

    int subscriberCount() {
        return subscribers.values().stream().mapToInt(List::size).sum();
    }
}
