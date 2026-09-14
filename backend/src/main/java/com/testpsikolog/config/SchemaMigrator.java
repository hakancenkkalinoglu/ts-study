package com.testpsikolog.config;

import java.util.List;
import java.util.Map;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class SchemaMigrator implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public SchemaMigrator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        createCoreTables();

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

        if (!hasColumn("appointments", "status")) {
            jdbc.execute("ALTER TABLE appointments ADD COLUMN status TEXT");
        }
        jdbc.update("UPDATE appointments SET status = 'scheduled' WHERE status IS NULL OR status = ''");

        if (!hasColumn("clients", "phone")) {
            jdbc.execute("ALTER TABLE clients ADD COLUMN phone TEXT");
        }
        if (!hasColumn("clients", "emergencyName")) {
            jdbc.execute("ALTER TABLE clients ADD COLUMN emergencyName TEXT");
        }
        if (!hasColumn("clients", "emergencyPhone")) {
            jdbc.execute("ALTER TABLE clients ADD COLUMN emergencyPhone TEXT");
        }

        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS clinics (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  inviteCode TEXT NOT NULL UNIQUE,
                  ownerUserId INTEGER NOT NULL,
                  createdAt TEXT NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS clinic_members (
                  clinicId INTEGER NOT NULL,
                  userId INTEGER NOT NULL,
                  role TEXT NOT NULL,
                  createdAt TEXT NOT NULL,
                  PRIMARY KEY (clinicId, userId)
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS clinic_rooms (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  clinicId INTEGER NOT NULL,
                  name TEXT NOT NULL,
                  color TEXT,
                  createdAt TEXT NOT NULL
                )
                """
        );
        if (!hasColumn("appointments", "clinicId")) {
            jdbc.execute("ALTER TABLE appointments ADD COLUMN clinicId INTEGER");
        }
        if (!hasColumn("appointments", "roomId")) {
            jdbc.execute("ALTER TABLE appointments ADD COLUMN roomId INTEGER");
        }
        if (!hasColumn("appointments", "durationMinutes")) {
            jdbc.execute("ALTER TABLE appointments ADD COLUMN durationMinutes INTEGER");
        }
        jdbc.update("UPDATE appointments SET durationMinutes = 50 WHERE durationMinutes IS NULL");
        if (!hasColumn("appointments", "seriesId")) {
            jdbc.execute("ALTER TABLE appointments ADD COLUMN seriesId TEXT");
        }

        if (!hasColumn("app_users", "displayName")) {
            jdbc.execute("ALTER TABLE app_users ADD COLUMN displayName TEXT");
        }
        if (!hasColumn("app_users", "reminderHours")) {
            jdbc.execute("ALTER TABLE app_users ADD COLUMN reminderHours INTEGER");
        }
        jdbc.update("UPDATE app_users SET reminderHours = 24 WHERE reminderHours IS NULL");
        if (!hasColumn("appointments", "sessionFee")) {
            jdbc.execute("ALTER TABLE appointments ADD COLUMN sessionFee INTEGER");
        }
        if (!hasColumn("client_notes", "fileName")) {
            jdbc.execute("ALTER TABLE client_notes ADD COLUMN fileName TEXT");
        }

        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                  email TEXT NOT NULL,
                  codeHash TEXT NOT NULL,
                  expiresAt INTEGER NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS session_packages (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  clientId INTEGER NOT NULL,
                  title TEXT NOT NULL,
                  totalSessions INTEGER NOT NULL,
                  remainingSessions INTEGER NOT NULL,
                  prepaidAmount INTEGER NOT NULL DEFAULT 0,
                  createdAt TEXT NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS psych_inventories (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  code TEXT NOT NULL UNIQUE,
                  name TEXT NOT NULL,
                  description TEXT,
                  maxScore INTEGER NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS psych_inventory_items (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  inventoryId INTEGER NOT NULL,
                  sortOrder INTEGER NOT NULL,
                  prompt TEXT NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS client_inventory_results (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  clientId INTEGER NOT NULL,
                  inventoryId INTEGER NOT NULL,
                  answers TEXT NOT NULL,
                  score INTEGER NOT NULL,
                  interpretation TEXT NOT NULL,
                  createdAt TEXT NOT NULL
                )
                """
        );
        jdbc.update("DELETE FROM auth_exchange_codes WHERE expiresAt < ?", System.currentTimeMillis());
        jdbc.update("DELETE FROM password_reset_tokens WHERE expiresAt < ?", System.currentTimeMillis());
    }

    private void createCoreTables() {
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS app_users (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT NOT NULL,
                  email TEXT,
                  passwordHash TEXT NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS clients (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  email TEXT,
                  name TEXT,
                  birthDate TEXT,
                  agreedFee INTEGER,
                  password TEXT,
                  userId INTEGER,
                  phone TEXT,
                  emergencyName TEXT,
                  emergencyPhone TEXT,
                  createdAt TEXT NOT NULL,
                  updatedAt TEXT NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS appointments (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  clientId INTEGER NOT NULL,
                  appointmentDate TEXT NOT NULL,
                  appointmentTime TEXT,
                  title TEXT,
                  isPaid INTEGER NOT NULL DEFAULT 0,
                  status TEXT,
                  googleEventId TEXT,
                  googleMeetLink TEXT,
                  googleHtmlLink TEXT,
                  clinicId INTEGER,
                  roomId INTEGER,
                  durationMinutes INTEGER NOT NULL DEFAULT 50,
                  seriesId TEXT,
                  createdAt TEXT NOT NULL,
                  updatedAt TEXT NOT NULL
                )
                """
        );
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS client_notes (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  clientId INTEGER NOT NULL,
                  appointmentId INTEGER,
                  title TEXT,
                  content TEXT,
                  filePath TEXT,
                  noteDate TEXT,
                  createdAt TEXT NOT NULL,
                  updatedAt TEXT NOT NULL
                )
                """
        );
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
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_exchange_codes (
                  code TEXT PRIMARY KEY,
                  token TEXT NOT NULL,
                  expiresAt INTEGER NOT NULL
                )
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
