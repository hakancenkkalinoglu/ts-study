package com.testpsikolog.config;

import java.util.List;
import java.util.Map;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class SchemaMigrator implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public SchemaMigrator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!hasColumn("clients", "userId")) {
            jdbc.execute("ALTER TABLE clients ADD COLUMN userId INTEGER");
        }
        Long firstUserId = jdbc.query(
                "SELECT id FROM app_users ORDER BY id ASC LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null
        );
        if (firstUserId != null) {
            jdbc.update("UPDATE clients SET userId = ? WHERE userId IS NULL", firstUserId);
        }

        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS google_tokens (
                  userId INTEGER PRIMARY KEY,
                  accessToken TEXT NOT NULL,
                  refreshToken TEXT,
                  expiryDate INTEGER
                )
                """
        );

        if (!hasColumn("app_users", "email")) {
            jdbc.execute("ALTER TABLE app_users ADD COLUMN email TEXT");
        }
        jdbc.update(
                """
                UPDATE app_users
                SET email = username
                WHERE email IS NULL AND username LIKE '%@%'
                """
        );
    }

    private boolean hasColumn(String table, String column) {
        List<Map<String, Object>> cols = jdbc.queryForList("PRAGMA table_info(" + table + ")");
        return cols.stream().anyMatch(row -> {
            Object name = row.get("name");
            if (name == null) {
                name = row.get("NAME");
            }
            return column.equalsIgnoreCase(String.valueOf(name));
        });
    }
}
