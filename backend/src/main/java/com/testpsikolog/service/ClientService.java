package com.testpsikolog.service;

import com.testpsikolog.dto.ClientResponse;
import com.testpsikolog.dto.CreateClientRequest;
import com.testpsikolog.dto.UpdateClientRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClientService {

    private static final String CLIENT_COLUMNS =
            "id, email, name, birthDate, agreedFee, phone, emergencyName, emergencyPhone, createdAt, updatedAt";

    private static final RowMapper<ClientResponse> CLIENT_MAPPER = (rs, rowNum) -> new ClientResponse(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("name"),
            rs.getString("birthDate"),
            rs.getObject("agreedFee") == null ? null : rs.getInt("agreedFee"),
            rs.getString("phone"),
            rs.getString("emergencyName"),
            rs.getString("emergencyPhone"),
            rs.getString("createdAt"),
            rs.getString("updatedAt")
    );

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public ClientService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    public List<ClientResponse> getAll(long userId, String search) {
        if (search != null && !search.trim().isEmpty()) {
            String pattern = "%" + search.trim() + "%";
            return jdbc.query(
                    "SELECT " + CLIENT_COLUMNS
                            + " FROM clients WHERE userId = ? AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR emergencyPhone LIKE ? OR emergencyName LIKE ?) ORDER BY name ASC",
                    CLIENT_MAPPER,
                    userId,
                    pattern,
                    pattern,
                    pattern,
                    pattern,
                    pattern
            );
        }
        return jdbc.query(
                "SELECT " + CLIENT_COLUMNS + " FROM clients WHERE userId = ? ORDER BY name ASC",
                CLIENT_MAPPER,
                userId
        );
    }

    public ClientResponse getById(long userId, long id) {
        List<ClientResponse> rows = jdbc.query(
                "SELECT " + CLIENT_COLUMNS + " FROM clients WHERE id = ? AND userId = ?",
                CLIENT_MAPPER,
                id,
                userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public long create(long userId, CreateClientRequest request) {
        String name = requireName(request.name());
        String email = normalizeOptionalEmail(request.email());
        assertEmailAvailable(userId, email, null);
        String hashed = null;
        if (request.password() != null && !request.password().isBlank()) {
            hashed = passwordEncoder.encode(request.password());
        }
        int agreedFee = request.agreedFee() == null ? 2000 : request.agreedFee();
        jdbc.update(
                """
                INSERT INTO clients (email, name, birthDate, agreedFee, password, userId, phone, emergencyName, emergencyPhone, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                email,
                name,
                blankToNull(request.birthDate()),
                agreedFee,
                hashed,
                userId,
                blankToNull(request.phone()),
                blankToNull(request.emergencyName()),
                blankToNull(request.emergencyPhone())
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return id == null ? 0L : id;
    }

    public int update(long userId, long id, UpdateClientRequest data) {
        if (!ownsClient(userId, id)) {
            return 0;
        }
        String name = data.name() == null ? null : requireName(data.name());
        boolean emailProvided = data.email() != null;
        String email = emailProvided ? normalizeOptionalEmail(data.email()) : null;
        if (emailProvided) {
            assertEmailAvailable(userId, email, id);
        }
        String hashed = null;
        if (data.password() != null && !data.password().isBlank()) {
            hashed = passwordEncoder.encode(data.password());
        }
        return jdbc.update(
                """
                UPDATE clients
                SET
                  email = CASE WHEN ? = 1 THEN ? ELSE email END,
                  name = COALESCE(?, name),
                  birthDate = CASE WHEN ? = 1 THEN ? ELSE birthDate END,
                  agreedFee = CASE WHEN ? IS NOT NULL THEN ? ELSE agreedFee END,
                  password = COALESCE(?, password),
                  phone = COALESCE(?, phone),
                  emergencyName = COALESCE(?, emergencyName),
                  emergencyPhone = COALESCE(?, emergencyPhone),
                  updatedAt = datetime('now')
                WHERE id = ? AND userId = ?
                """,
                emailProvided ? 1 : 0,
                email,
                name,
                data.birthDate() != null ? 1 : 0,
                data.birthDate() == null ? null : blankToNull(data.birthDate()),
                data.agreedFee(),
                data.agreedFee(),
                hashed,
                trimPresent(data.phone()),
                trimPresent(data.emergencyName()),
                trimPresent(data.emergencyPhone()),
                id,
                userId
        );
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ad soyad zorunludur.");
        }
        return name.trim();
    }

    private static String normalizeOptionalEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String normalized = email.trim().toLowerCase();
        if (!normalized.contains("@") || normalized.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-posta geçerli değil.");
        }
        return normalized;
    }

    private void assertEmailAvailable(long userId, String email, Long excludeClientId) {
        if (email == null) {
            return;
        }
        Long found;
        if (excludeClientId == null) {
            found = jdbc.query(
                    "SELECT id FROM clients WHERE userId = ? AND lower(email) = ? LIMIT 1",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    userId,
                    email
            );
        } else {
            found = jdbc.query(
                    "SELECT id FROM clients WHERE userId = ? AND lower(email) = ? AND id <> ? LIMIT 1",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    userId,
                    email,
                    excludeClientId
            );
        }
        if (found != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu e-posta ile kayıtlı bir danışanınız zaten var.");
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String trimPresent(String value) {
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    @Transactional
    public int delete(long userId, long id) {
        if (!ownsClient(userId, id)) {
            return 0;
        }
        jdbc.update("DELETE FROM client_notes WHERE clientId = ?", id);
        jdbc.update("DELETE FROM appointments WHERE clientId = ?", id);
        jdbc.update("DELETE FROM session_packages WHERE clientId = ?", id);
        jdbc.update("DELETE FROM client_inventory_results WHERE clientId = ?", id);
        return jdbc.update("DELETE FROM clients WHERE id = ? AND userId = ?", id, userId);
    }

    public void requireOwned(long userId, long clientId) {
        if (!ownsClient(userId, clientId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Danışan bulunamadı.");
        }
    }

    public boolean ownsClient(long userId, long clientId) {
        Integer exists = jdbc.query(
                "SELECT id FROM clients WHERE id = ? AND userId = ?",
                rs -> rs.next() ? rs.getInt("id") : null,
                clientId,
                userId
        );
        return exists != null;
    }
}
