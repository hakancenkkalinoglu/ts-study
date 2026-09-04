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
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClientService {

    private static final RowMapper<ClientResponse> CLIENT_MAPPER = (rs, rowNum) -> new ClientResponse(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("name"),
            rs.getString("birthDate"),
            rs.getObject("agreedFee") == null ? null : rs.getInt("agreedFee"),
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
                    """
                    SELECT id, email, name, birthDate, agreedFee, createdAt, updatedAt
                    FROM clients
                    WHERE userId = ? AND (name LIKE ? OR email LIKE ?)
                    ORDER BY name ASC
                    """,
                    CLIENT_MAPPER,
                    userId,
                    pattern,
                    pattern
            );
        }
        return jdbc.query(
                """
                SELECT id, email, name, birthDate, agreedFee, createdAt, updatedAt
                FROM clients
                WHERE userId = ?
                ORDER BY name ASC
                """,
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
                INSERT INTO clients (email, name, birthDate, agreedFee, password, userId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                request.email(),
                request.name(),
                request.birthDate(),
                agreedFee,
                hashed,
                userId
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
                  updatedAt = datetime('now')
                WHERE id = ? AND userId = ?
                """,
                data.email(),
                data.name(),
                data.birthDate(),
                data.agreedFee(),
                data.agreedFee(),
                hashed,
                id,
                userId
        );
    }

    public int delete(long userId, long id) {
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
