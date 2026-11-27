package com.tradechameleon.identity;

/**
 * Published when an administrator deleted a broker's user. The login is gone; other modules react:
 * trading cancels the user's open orders, alerts and watchlist remove their entries. The account and
 * its history (cash ledger, closed trades) are kept, as a real broker must keep records.
 */
public record UserDeleted(String tenantId, String userId, String email) {
}
