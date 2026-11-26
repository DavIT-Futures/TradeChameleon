package com.tradechameleon.portfolio;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class PortfolioRepository {

    record AccountRow(UUID id, String tenantId, String userId, String currency, BigDecimal cash) {
    }

    record PositionRow(String symbol, BigDecimal quantity, BigDecimal avgPrice, BigDecimal stopLoss,
                       BigDecimal takeProfit) {
    }

    record ProtectedRow(String tenantId, String userId, String symbol, BigDecimal quantity, BigDecimal stopLoss,
                        BigDecimal takeProfit) {
    }

    private final JdbcClient jdbc;

    PortfolioRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---- accounts -------------------------------------------------------------------------

    Optional<AccountRow> findAccount(String tenantId, String userId) {
        return jdbc.sql("select id, tenant_id, user_id, currency, cash from account where tenant_id = ? and user_id = ?")
                .params(tenantId, userId)
                .query(AccountRow.class)
                .optional();
    }

    /** Idempotent: concurrent first requests of a new SSO user end up with one account. */
    boolean createAccountIfMissing(UUID id, String tenantId, String userId, String currency, BigDecimal cash) {
        return jdbc.sql("""
                        insert into account (id, tenant_id, user_id, currency, cash)
                        values (?, ?, ?, ?, ?)
                        on conflict (tenant_id, user_id) do nothing
                        """)
                .params(id, tenantId, userId, currency, cash)
                .update() == 1;
    }

    /** Locks the account row for the rest of the transaction (serialises fills per account). */
    Optional<AccountRow> lockAccount(String tenantId, String userId) {
        return jdbc.sql("select id, tenant_id, user_id, currency, cash from account "
                        + "where tenant_id = ? and user_id = ? for update")
                .params(tenantId, userId)
                .query(AccountRow.class)
                .optional();
    }

    void updateCash(UUID accountId, BigDecimal cash) {
        jdbc.sql("update account set cash = ? where id = ?").params(cash, accountId).update();
    }

    // ---- positions and protection ----------------------------------------------------------

    List<PositionRow> positions(UUID accountId) {
        return jdbc.sql("select symbol, quantity, avg_price, stop_loss, take_profit from position "
                        + "where account_id = ? order by symbol")
                .param(accountId)
                .query(PositionRow.class)
                .list();
    }

    Optional<PositionRow> position(UUID accountId, String symbol) {
        return jdbc.sql("select symbol, quantity, avg_price, stop_loss, take_profit from position "
                        + "where account_id = ? and symbol = ?")
                .params(accountId, symbol)
                .query(PositionRow.class)
                .optional();
    }

    void upsertPosition(UUID accountId, String symbol, BigDecimal quantity, BigDecimal avgPrice) {
        jdbc.sql("""
                        insert into position (account_id, symbol, quantity, avg_price) values (?, ?, ?, ?)
                        on conflict (account_id, symbol) do update
                        set quantity = excluded.quantity, avg_price = excluded.avg_price
                        """)
                .params(accountId, symbol, quantity, avgPrice)
                .update();
    }

    void deletePosition(UUID accountId, String symbol) {
        jdbc.sql("delete from position where account_id = ? and symbol = ?").params(accountId, symbol).update();
    }

    boolean setProtection(UUID accountId, String symbol, BigDecimal stopLoss, BigDecimal takeProfit) {
        return jdbc.sql("update position set stop_loss = ?, take_profit = ? where account_id = ? and symbol = ?")
                .params(stopLoss, takeProfit, accountId, symbol)
                .update() == 1;
    }

    /** Compare-and-set: true only for the caller that actually removed the protection. */
    boolean clearProtection(String tenantId, String userId, String symbol) {
        return jdbc.sql("""
                        update position p set stop_loss = null, take_profit = null
                        from account a
                        where p.account_id = a.id and a.tenant_id = ? and a.user_id = ? and p.symbol = ?
                          and (p.stop_loss is not null or p.take_profit is not null)
                        """)
                .params(tenantId, userId, symbol)
                .update() == 1;
    }

    List<ProtectedRow> protectedPositions(Collection<String> symbols) {
        if (symbols.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
                        select a.tenant_id, a.user_id, p.symbol, p.quantity, p.stop_loss, p.take_profit
                        from position p join account a on a.id = p.account_id
                        where p.symbol in (:symbols) and (p.stop_loss is not null or p.take_profit is not null)
                        """)
                .param("symbols", symbols)
                .query(ProtectedRow.class)
                .list();
    }

    // ---- ledger and realised P&L -------------------------------------------------------------

    void insertTransaction(UUID accountId, CashTransaction.Type type, BigDecimal amount, BigDecimal balanceAfter,
                           UUID reference, String description, Instant at) {
        jdbc.sql("""
                        insert into cash_transaction (id, account_id, type, amount, balance_after, reference, description, created_at)
                        values (?, ?, ?, ?, ?, ?, ?, ?)
                        """)
                .params(UUID.randomUUID(), accountId, type.name(), amount, balanceAfter, reference, description,
                        Timestamp.from(at))
                .update();
    }

    List<CashTransaction> transactions(UUID accountId, int limit) {
        return jdbc.sql("""
                        select id, type, amount, balance_after, reference, description, created_at
                        from cash_transaction where account_id = ? order by created_at desc, id limit ?
                        """)
                .params(accountId, limit)
                .query((rs, n) -> new CashTransaction(
                        rs.getObject("id", UUID.class),
                        CashTransaction.Type.valueOf(rs.getString("type")),
                        rs.getBigDecimal("amount"),
                        rs.getBigDecimal("balance_after"),
                        rs.getObject("reference", UUID.class),
                        rs.getString("description"),
                        rs.getTimestamp("created_at").toInstant()))
                .list();
    }

    void insertClosedTrade(UUID accountId, UUID orderId, String symbol, BigDecimal quantity, BigDecimal openPrice,
                           BigDecimal closePrice, String currency, BigDecimal realizedPnl, Instant at) {
        jdbc.sql("""
                        insert into closed_trade (id, account_id, order_id, symbol, quantity, open_price, close_price,
                                                  currency, realized_pnl, closed_at)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """)
                .params(UUID.randomUUID(), accountId, orderId, symbol, quantity, openPrice, closePrice, currency,
                        realizedPnl, Timestamp.from(at))
                .update();
    }

    List<ClosedTrade> closedTrades(UUID accountId, int limit) {
        return jdbc.sql("""
                        select id, order_id, symbol, quantity, open_price, close_price, currency, realized_pnl, closed_at
                        from closed_trade where account_id = ? order by closed_at desc limit ?
                        """)
                .params(accountId, limit)
                .query((rs, n) -> new ClosedTrade(
                        rs.getObject("id", UUID.class),
                        rs.getObject("order_id", UUID.class),
                        rs.getString("symbol"),
                        rs.getBigDecimal("quantity").stripTrailingZeros(),
                        rs.getBigDecimal("open_price"),
                        rs.getBigDecimal("close_price"),
                        rs.getString("currency"),
                        rs.getBigDecimal("realized_pnl"),
                        rs.getTimestamp("closed_at").toInstant()))
                .list();
    }

    BigDecimal realizedTotal(UUID accountId) {
        return jdbc.sql("select coalesce(sum(realized_pnl), 0) from closed_trade where account_id = ?")
                .param(accountId)
                .query(BigDecimal.class)
                .single();
    }
}
