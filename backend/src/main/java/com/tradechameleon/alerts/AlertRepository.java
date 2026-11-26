package com.tradechameleon.alerts;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class AlertRepository {

    /** An active alert plus its owner, for the monitor. */
    record ActiveAlert(String tenantId, String userId, PriceAlert alert) {
    }

    private final JdbcClient jdbc;

    AlertRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    void insert(String tenantId, String userId, PriceAlert a) {
        jdbc.sql("""
                        insert into price_alert (id, tenant_id, user_id, symbol, condition, price, note, status, created_at)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """)
                .params(a.id(), tenantId, userId, a.symbol(), a.condition().name(), a.price(), a.note(),
                        a.status().name(), Timestamp.from(a.createdAt()))
                .update();
    }

    List<PriceAlert> findForUser(String tenantId, String userId, PriceAlert.Status status) {
        return jdbc.sql("""
                        select * from price_alert
                        where tenant_id = :tenant and user_id = :user
                          and (cast(:status as varchar) is null or status = cast(:status as varchar))
                        order by created_at desc limit 200
                        """)
                .param("tenant", tenantId)
                .param("user", userId)
                .param("status", status == null ? null : status.name())
                .query((rs, n) -> map(rs))
                .list();
    }

    List<PriceAlert> unacknowledged(String tenantId, String userId) {
        return jdbc.sql("""
                        select * from price_alert
                        where tenant_id = ? and user_id = ? and status = 'TRIGGERED' and not acknowledged
                        order by triggered_at
                        """)
                .params(tenantId, userId)
                .query((rs, n) -> map(rs))
                .list();
    }

    Optional<PriceAlert> find(String tenantId, String userId, UUID id) {
        return jdbc.sql("select * from price_alert where id = ? and tenant_id = ? and user_id = ?")
                .params(id, tenantId, userId)
                .query((rs, n) -> map(rs))
                .optional();
    }

    List<ActiveAlert> active(Collection<String> symbols) {
        if (symbols.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select * from price_alert where status = 'ACTIVE' and symbol in (:symbols)")
                .param("symbols", symbols)
                .query((rs, n) -> new ActiveAlert(rs.getString("tenant_id"), rs.getString("user_id"), map(rs)))
                .list();
    }

    /** Compare-and-set ACTIVE → TRIGGERED. */
    boolean trigger(UUID id, BigDecimal price, Instant at) {
        return jdbc.sql("update price_alert set status = 'TRIGGERED', triggered_at = ?, triggered_price = ? "
                        + "where id = ? and status = 'ACTIVE'")
                .params(Timestamp.from(at), price, id)
                .update() == 1;
    }

    boolean cancel(UUID id) {
        return jdbc.sql("update price_alert set status = 'CANCELLED' where id = ? and status = 'ACTIVE'")
                .param(id)
                .update() == 1;
    }

    void acknowledge(String tenantId, String userId, UUID id) {
        jdbc.sql("update price_alert set acknowledged = true where id = ? and tenant_id = ? and user_id = ?")
                .params(id, tenantId, userId)
                .update();
    }

    private static PriceAlert map(ResultSet rs) throws SQLException {
        Timestamp triggered = rs.getTimestamp("triggered_at");
        return new PriceAlert(
                rs.getObject("id", UUID.class),
                rs.getString("symbol"),
                PriceAlert.Condition.valueOf(rs.getString("condition")),
                rs.getBigDecimal("price"),
                rs.getString("note"),
                PriceAlert.Status.valueOf(rs.getString("status")),
                rs.getBoolean("acknowledged"),
                rs.getTimestamp("created_at").toInstant(),
                triggered == null ? null : triggered.toInstant(),
                rs.getBigDecimal("triggered_price"));
    }
}
