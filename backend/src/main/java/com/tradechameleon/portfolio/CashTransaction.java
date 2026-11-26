package com.tradechameleon.portfolio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One line of the account statement.
 *
 * @param amount       signed amount in the account currency (+ deposit / sell, − withdrawal / buy)
 * @param balanceAfter cash balance right after this operation
 * @param reference    the order id for BUY and SELL lines
 */
public record CashTransaction(
        UUID id,
        Type type,
        BigDecimal amount,
        BigDecimal balanceAfter,
        UUID reference,
        String description,
        Instant createdAt) {

    public enum Type { DEPOSIT, WITHDRAWAL, BUY, SELL }
}
