package com.tradechameleon.portfolio;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class PortfolioRepository {

    record AccountRow(UUID id, String tenantId, String userId, String currency, BigDecimal cash) {
    }

    record PositionRow(String symbol, BigDecimal quantity, BigDecimal avgPrice) {
    }

    private final JdbcClient jdbc;

    PortfolioRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    Optional<AccountRow> findAccount(String tenantId, String userId) {
        return jdbc.sql("select id, tenant_id, user_id, currency, cash from account where tenant_id = ? and user_id = ?")
                .params(tenantId, userId)
                .query(AccountRow.class)
                .optional();
    }

    /** Idempotent: concurrent first requests of a new SSO user end up with one account. */
    void createAccountIfMissing(String tenantId, String userId, String currency, BigDecimal cash) {
        jdbc.sql("""
                        insert into account (id, tenant_id, user_id, currency, cash)
                        values (?, ?, ?, ?, ?)
                        on conflict (tenant_id, user_id) do nothing
                        """)
                .params(UUID.randomUUID(), tenantId, userId, currency, cash)
                .update();
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

    List<PositionRow> positions(UUID accountId) {
        return jdbc.sql("select symbol, quantity, avg_price from position where account_id = ? order by symbol")
                .param(accountId)
                .query(PositionRow.class)
                .list();
    }

    Optional<PositionRow> position(UUID accountId, String symbol) {
        return jdbc.sql("select symbol, quantity, avg_price from position where account_id = ? and symbol = ?")
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
}
