package com.tradechameleon.tenant;

import java.time.Instant;
import java.util.List;

/**
 * Published after an admin changed a broker's settings. The new settings are already live in
 * {@link TenantDirectory}; listeners use the event for side effects such as the audit log.
 *
 * @param changes human-readable "field: old → new" lines
 */
public record TenantUpdated(String tenantId, String changedBy, Instant changedAt, List<String> changes) {
}
