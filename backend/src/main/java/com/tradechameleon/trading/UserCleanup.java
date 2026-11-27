package com.tradechameleon.trading;

import com.tradechameleon.identity.UserDeleted;
import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * A deleted user must not keep trading: pending orders would otherwise still fill against their
 * account. Cancelled (not deleted) so the order history stays complete.
 */
@Component("tradingUserCleanup")
class UserCleanup {

    private final JdbcClient jdbc;

    UserCleanup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @ApplicationModuleListener
    void on(UserDeleted event) {
        jdbc.sql("""
                        update trade_order set status = 'CANCELLED', reject_reason = 'User deleted', updated_at = ?
                        where tenant_id = ? and user_id = ? and status = 'OPEN'
                        """)
                .params(Timestamp.from(Instant.now()), event.tenantId(), event.userId())
                .update();
    }
}
