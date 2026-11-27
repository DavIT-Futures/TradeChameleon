package com.tradechameleon.tenant;

import com.tradechameleon.shared.DomainException;
import com.tradechameleon.shared.FxRates;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public API of the tenant module: an in-memory directory of all brokers, loaded at startup.
 * Every request reads tenants from memory instead of the database. When an admin changes a broker,
 * {@link #update} writes the database and swaps the in-memory copy, so the change is live for the
 * very next request (spreads, feature checks, limits, branding).
 */
@Service
public class TenantDirectory {

    /** Copy-on-write: readers never lock, the rare writer replaces the whole (small) map. */
    private volatile Map<String, Tenant> tenants;
    private final String defaultTenantId;
    private final TenantRepository repository;
    private final ApplicationEventPublisher events;

    TenantDirectory(TenantRepository repository, TenantProperties properties, ApplicationEventPublisher events) {
        this.repository = repository;
        this.events = events;
        var all = new LinkedHashMap<String, Tenant>();
        repository.findAll().forEach(t -> all.put(t.id(), t));
        this.tenants = all;
        this.defaultTenantId = properties.defaultTenant();
    }

    public Collection<Tenant> all() {
        return tenants.values();
    }

    public Optional<Tenant> find(String id) {
        return Optional.ofNullable(id).map(String::toLowerCase).map(tenants::get);
    }

    public Tenant get(String id) {
        return find(id).orElseThrow(() -> DomainException.notFound("Tenant", id));
    }

    public Tenant defaultTenant() {
        return get(defaultTenantId);
    }

    /**
     * Saves new settings for a broker and makes them live. Publishes {@link TenantUpdated} with a diff.
     *
     * @throws DomainException 404 for an unknown broker, 422 for an unsupported currency or logo shape
     */
    @Transactional
    public synchronized Tenant update(String id, TenantSettings settings, String changedBy) {
        Tenant before = get(id);
        if (!FxRates.supported().contains(settings.currency())) {
            throw DomainException.unprocessable("unsupported-currency", "Unsupported currency",
                    settings.currency() + " is not supported. Use one of " + FxRates.supported() + ".",
                    Map.of("supported", FxRates.supported()));
        }
        if (!LogoGenerator.SHAPES.contains(settings.logoShape())) {
            throw DomainException.unprocessable("unknown-logo-shape", "Unknown logo shape",
                    settings.logoShape() + " is not a logo shape. Use one of " + LogoGenerator.SHAPES + ".",
                    Map.of("supported", LogoGenerator.SHAPES));
        }
        List<String> changes = diff("", TenantSettings.of(before), settings);
        if (changes.isEmpty()) {
            return before;
        }
        repository.update(before.id(), settings);
        Tenant after = repository.findById(before.id());
        var copy = new LinkedHashMap<>(tenants);
        copy.put(after.id(), after);
        tenants = copy;
        events.publishEvent(new TenantUpdated(after.id(), changedBy, Instant.now(), changes));
        return after;
    }

    /** "field: old → new" for every leaf that differs; nested records are walked recursively. */
    static List<String> diff(String prefix, Record before, Record after) {
        var out = new ArrayList<String>();
        for (RecordComponent c : before.getClass().getRecordComponents()) {
            Object a = value(c, before);
            Object b = value(c, after);
            String name = prefix + c.getName();
            if (a instanceof Record ra && b instanceof Record rb) {
                out.addAll(diff(name + ".", ra, rb));
            } else if (!Objects.equals(normalize(a), normalize(b))) {
                out.add(name + ": " + a + " → " + b);
            }
        }
        return out;
    }

    private static Object normalize(Object v) {
        return v instanceof BigDecimal d ? d.stripTrailingZeros() : v;
    }

    private static Object value(RecordComponent c, Record r) {
        try {
            return c.getAccessor().invoke(r);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
