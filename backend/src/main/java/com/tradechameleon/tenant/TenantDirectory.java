package com.tradechameleon.tenant;

import com.tradechameleon.shared.DomainException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Public API of the tenant module: an in-memory directory of all brokers, loaded once at startup.
 * Tenants change rarely, so every request reads them from memory instead of the database.
 */
@Service
public class TenantDirectory {

    private final Map<String, Tenant> tenants = new LinkedHashMap<>();
    private final String defaultTenantId;

    TenantDirectory(TenantRepository repository, TenantProperties properties) {
        repository.findAll().forEach(t -> tenants.put(t.id(), t));
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
}
