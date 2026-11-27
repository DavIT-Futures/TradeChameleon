package com.tradechameleon.alerts;

import com.tradechameleon.identity.UserDeleted;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/** Alerts of a deleted user would never be seen again: remove them. */
@Component("alertsUserCleanup")
class UserCleanup {

    private final JdbcClient jdbc;

    UserCleanup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @ApplicationModuleListener
    void on(UserDeleted event) {
        jdbc.sql("delete from price_alert where tenant_id = ? and user_id = ?")
                .params(event.tenantId(), event.userId())
                .update();
    }
}
