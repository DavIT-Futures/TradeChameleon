package com.tradechameleon.trading;

import com.tradechameleon.shared.Side;
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
class OrderRepository {

    private final JdbcClient jdbc;

    OrderRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    void insert(Order o) {
        jdbc.sql("""
                        insert into trade_order (id, tenant_id, user_id, symbol, side, type, quantity, limit_price,
                                                 stop_price, stop_loss, take_profit, status, triggered, origin,
                                                 fill_price, reject_reason, created_at, updated_at)
                        values (:id, :tenantId, :userId, :symbol, :side, :type, :quantity, :limitPrice,
                                :stopPrice, :stopLoss, :takeProfit, :status, :triggered, :origin,
                                :fillPrice, :rejectReason, :createdAt, :updatedAt)
                        """)
                .param("id", o.id())
                .param("tenantId", o.tenantId())
                .param("userId", o.userId())
                .param("symbol", o.symbol())
                .param("side", o.side().name())
                .param("type", o.type().name())
                .param("quantity", o.quantity())
                .param("limitPrice", o.limitPrice())
                .param("stopPrice", o.stopPrice())
                .param("stopLoss", o.stopLoss())
                .param("takeProfit", o.takeProfit())
                .param("status", o.status().name())
                .param("triggered", o.triggered())
                .param("origin", o.origin().name())
                .param("fillPrice", o.fillPrice())
                .param("rejectReason", o.rejectReason())
                .param("createdAt", Timestamp.from(o.createdAt()))
                .param("updatedAt", Timestamp.from(o.updatedAt()))
                .update();
    }

    /**
     * Compare-and-set status change: only succeeds while the order is still OPEN, so a cancel and a
     * fill racing each other can never both win.
     */
    boolean transitionFromOpen(UUID id, Order.OrderStatus status, BigDecimal fillPrice, String reason) {
        return jdbc.sql("""
                        update trade_order set status = ?, fill_price = ?, reject_reason = ?, updated_at = ?
                        where id = ? and status = 'OPEN'
                        """)
                .params(status.name(), fillPrice, reason, Timestamp.from(Instant.now()), id)
                .update() == 1;
    }

    /** A STOP_LIMIT whose stop was hit becomes a resting limit order. */
    boolean markTriggered(UUID id) {
        return jdbc.sql("update trade_order set triggered = true, updated_at = ? where id = ? and status = 'OPEN' and not triggered")
                .params(Timestamp.from(Instant.now()), id)
                .update() == 1;
    }

    int countOpen(String tenantId, String userId) {
        return jdbc.sql("select count(*) from trade_order where tenant_id = ? and user_id = ? and status = 'OPEN'")
                .params(tenantId, userId)
                .query(Integer.class)
                .single();
    }

    Optional<Order> find(String tenantId, String userId, UUID id) {
        return jdbc.sql("select * from trade_order where id = ? and tenant_id = ? and user_id = ?")
                .params(id, tenantId, userId)
                .query((rs, n) -> map(rs))
                .optional();
    }

    List<Order> findForUser(String tenantId, String userId, Order.OrderStatus status, int limit) {
        return jdbc.sql("""
                        select * from trade_order
                        where tenant_id = :tenant and user_id = :user
                          and (cast(:status as varchar) is null or status = cast(:status as varchar))
                        order by created_at desc limit :limit
                        """)
                .param("tenant", tenantId)
                .param("user", userId)
                .param("status", status == null ? null : status.name())
                .param("limit", limit)
                .query((rs, n) -> map(rs))
                .list();
    }

    List<Order> findOpen(Collection<String> symbols) {
        if (symbols.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select * from trade_order where status = 'OPEN' and symbol in (:symbols) order by created_at")
                .param("symbols", symbols)
                .query((rs, n) -> map(rs))
                .list();
    }

    private static Order map(ResultSet rs) throws SQLException {
        return new Order(
                rs.getObject("id", UUID.class),
                rs.getString("tenant_id"),
                rs.getString("user_id"),
                rs.getString("symbol"),
                Side.valueOf(rs.getString("side")),
                Order.OrderType.valueOf(rs.getString("type")),
                rs.getBigDecimal("quantity").stripTrailingZeros(),
                rs.getBigDecimal("limit_price"),
                rs.getBigDecimal("stop_price"),
                rs.getBigDecimal("stop_loss"),
                rs.getBigDecimal("take_profit"),
                Order.OrderStatus.valueOf(rs.getString("status")),
                rs.getBoolean("triggered"),
                Order.Origin.valueOf(rs.getString("origin")),
                rs.getBigDecimal("fill_price"),
                rs.getString("reject_reason"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}
