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

    public List<ClientResponse> getAll(String search) {
        if (search != null && !search.trim().isEmpty()) {
            String pattern = "%" + search.trim() + "%";
            return jdbc.query(
                    "SELECT id, email, name, birthDate, agreedFee, createdAt, updatedAt FROM clients WHERE name LIKE ? OR email LIKE ? ORDER BY name ASC",
                    CLIENT_MAPPER,
                    pattern,
                    pattern
            );
        }
        return jdbc.query(
                "SELECT id, email, name, birthDate, agreedFee, createdAt, updatedAt FROM clients ORDER BY name ASC",
                CLIENT_MAPPER
        );
    }

    public long create(CreateClientRequest request) {
        String hashed = null;
        if (request.password() != null && !request.password().isBlank()) {
            hashed = passwordEncoder.encode(request.password());
        }
        int agreedFee = request.agreedFee() == null ? 2000 : request.agreedFee();
        jdbc.update(
                """
                INSERT INTO clients (email, name, birthDate, agreedFee, password, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                request.email(),
                request.name(),
                request.birthDate(),
                agreedFee,
                hashed
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return id == null ? 0L : id;
    }

    public int update(long id, UpdateClientRequest data) {
        Integer exists = jdbc.query(
                "SELECT id FROM clients WHERE id = ?",
                rs -> rs.next() ? rs.getInt("id") : null,
                id
        );
        if (exists == null) {
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
                WHERE id = ?
                """,
                data.email(),
                data.name(),
                data.birthDate(),
                data.agreedFee(),
                data.agreedFee(),
                hashed,
                id
        );
    }

    public int delete(long id) {
        return jdbc.update("DELETE FROM clients WHERE id = ?", id);
    }

    public void requireExists(long id) {
        Integer exists = jdbc.query(
                "SELECT id FROM clients WHERE id = ?",
                rs -> rs.next() ? rs.getInt("id") : null,
                id
        );
        if (exists == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found");
        }
    }
}
