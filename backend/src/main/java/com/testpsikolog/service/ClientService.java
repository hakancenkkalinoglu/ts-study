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

    public long create(long userId, CreateClientRequest request) {
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
                request.email(),
                request.name(),
                request.birthDate(),
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
        String hashed = null;
        if (data.password() != null && !data.password().isBlank()) {
            hashed = passwordEncoder.encode(data.password());
        }
        return jdbc.update(
                """
                UPDATE clients
                SET
                  email = COALESCE(?, email),
                  name = COALESCE(?, name),
                  birthDate = COALESCE(?, birthDate),
                  agreedFee = CASE WHEN ? IS NOT NULL THEN ? ELSE agreedFee END,
                  password = COALESCE(?, password),
                  phone = COALESCE(?, phone),
                  emergencyName = COALESCE(?, emergencyName),
                  emergencyPhone = COALESCE(?, emergencyPhone),
                  updatedAt = datetime('now')
                WHERE id = ? AND userId = ?
                """,
                data.email(),
                data.name(),
                data.birthDate(),
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
        return jdbc.update("DELETE FROM clients WHERE id = ? AND userId = ?", id, userId);
    }

    public void requireOwned(long userId, long clientId) {
        if (!ownsClient(userId, clientId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found");
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
