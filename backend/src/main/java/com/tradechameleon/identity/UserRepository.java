package com.tradechameleon.identity;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class UserRepository {

    record UserRow(UUID id, String tenantId, String email, String displayName, String passwordHash,
                   List<String> roles) {
    }

    private final JdbcClient jdbc;

    UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** A platform operator (super admin): not a user of any broker, see migration V8. */
    Optional<UserRow> findPlatformUser(String email) {
        return jdbc.sql("""
                        select id, email, display_name, password_hash, roles
                        from platform_user where lower(email) = lower(:email)
                        """)
                .param("email", email)
                .query((rs, n) -> new UserRow(
                        rs.getObject("id", UUID.class),
                        null,
                        rs.getString("email"),
                        rs.getString("display_name"),
                        rs.getString("password_hash"),
                        Arrays.asList((String[]) rs.getArray("roles").getArray())))
                .optional();
    }

    Optional<UserRow> findByTenantAndEmail(String tenantId, String email) {
        return jdbc.sql("""
                        select id, tenant_id, email, display_name, password_hash, roles
                        from app_user where tenant_id = :tenant and lower(email) = lower(:email)
                        """)
                .param("tenant", tenantId)
                .param("email", email)
                .query((rs, n) -> new UserRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("tenant_id"),
                        rs.getString("email"),
                        rs.getString("display_name"),
                        rs.getString("password_hash"),
                        Arrays.asList((String[]) rs.getArray("roles").getArray())))
                .optional();
    }
}
