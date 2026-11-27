package com.tradechameleon.identity;

import java.time.Instant;
import java.util.List;

/** Users of a broker were created, changed or deleted; the admin module writes it to the audit log. */
public record UserAccountsChanged(String tenantId, String changedBy, Instant changedAt, List<String> changes) {
}
