package com.tradechameleon.identity;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class UserRepository {

    record UserRow(UUID id, String tenantId, String email, String displayName, String passwordHash,
                   List<String> roles, boolean enabled, Instant createdAt) {
    }

    private static final String COLUMNS = "id, tenant_id, email, display_name, password_hash, roles, enabled, created_at";

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
                        roles(rs),
                        true,
                        null))
                .optional();
    }

    Optional<UserRow> findByTenantAndEmail(String tenantId, String email) {
        return jdbc.sql("select " + COLUMNS + " from app_user where tenant_id = :tenant and lower(email) = lower(:email)")
                .param("tenant", tenantId)
                .param("email", email)
                .query((rs, n) -> map(rs))
                .optional();
    }

    Optional<UserRow> findById(String tenantId, UUID id) {
        return jdbc.sql("select " + COLUMNS + " from app_user where tenant_id = ? and id = ?")
                .params(tenantId, id)
                .query((rs, n) -> map(rs))
                .optional();
    }

    List<UserRow> findAll(String tenantId) {
        return jdbc.sql("select " + COLUMNS + " from app_user where tenant_id = ? order by created_at, email")
                .param(tenantId)
                .query((rs, n) -> map(rs))
                .list();
    }

    void insert(UserRow u) {
        jdbc.sql("""
                        insert into app_user (id, tenant_id, email, display_name, password_hash, roles, enabled, created_at)
                        values (?, ?, ?, ?, ?, cast(? as text[]), ?, ?)
                        """)
                .params(u.id(), u.tenantId(), u.email(), u.displayName(), u.passwordHash(), array(u.roles()),
                        u.enabled(), Timestamp.from(u.createdAt()))
                .update();
    }

    void update(UserRow u) {
        jdbc.sql("""
                        update app_user set display_name = ?, password_hash = ?, roles = cast(? as text[]), enabled = ?
                        where id = ? and tenant_id = ?
                        """)
                .params(u.displayName(), u.passwordHash(), array(u.roles()), u.enabled(), u.id(), u.tenantId())
                .update();
    }

    void delete(UUID id) {
        jdbc.sql("delete from app_user where id = ?").param(id).update();
    }

    private static UserRow map(ResultSet rs) throws SQLException {
        return new UserRow(
                rs.getObject("id", UUID.class),
                rs.getString("tenant_id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getString("password_hash"),
                roles(rs),
                rs.getBoolean("enabled"),
                rs.getTimestamp("created_at").toInstant());
    }

    private static List<String> roles(ResultSet rs) throws SQLException {
        return Arrays.asList((String[]) rs.getArray("roles").getArray());
    }

    private static String array(List<String> values) {
        return "{" + String.join(",", values) + "}";
    }
}
