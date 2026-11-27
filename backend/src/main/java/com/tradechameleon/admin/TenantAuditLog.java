package com.tradechameleon.admin;

import com.tradechameleon.tenant.TenantUpdated;
import java.sql.Timestamp;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Writes every broker settings change to {@code tenant_change}. It reacts to the tenant module's
 * {@link TenantUpdated} event instead of being called directly, so the tenant module knows nothing
 * about auditing; the event publication registry retries the write if it fails.
 */
@Component
class TenantAuditLog {

    private final JdbcClient jdbc;

    TenantAuditLog(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @ApplicationModuleListener
    void on(TenantUpdated event) {
        jdbc.sql("insert into tenant_change (tenant_id, changed_by, changed_at, changes) values (?, ?, ?, cast(? as text[]))")
                .params(event.tenantId(), event.changedBy(), Timestamp.from(event.changedAt()), toArray(event.changes()))
                .update();
    }

    /** PostgreSQL array literal: {"a","b"} with quotes and backslashes escaped. */
    static String toArray(java.util.List<String> values) {
        var sb = new StringBuilder("{");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append('"').append(values.get(i).replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
        }
        return sb.append('}').toString();
    }
}
