package com.tradechameleon.watchlist;

import com.tradechameleon.identity.UserDeleted;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/** The watchlist of a deleted user is personal data with no further use: remove it. */
@Component("watchlistUserCleanup")
class UserCleanup {

    private final JdbcClient jdbc;

    UserCleanup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @ApplicationModuleListener
    void on(UserDeleted event) {
        jdbc.sql("delete from watchlist_item where tenant_id = ? and user_id = ?")
                .params(event.tenantId(), event.userId())
                .update();
    }
}
