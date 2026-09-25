package com.testpsikolog.service;

import com.testpsikolog.dto.CreatePackageRequest;
import com.testpsikolog.dto.ExpiringPackageResponse;
import com.testpsikolog.dto.SessionPackageResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PackageService {

    private static final RowMapper<SessionPackageResponse> MAPPER = (rs, rowNum) -> new SessionPackageResponse(
            rs.getLong("id"),
            rs.getLong("clientId"),
            rs.getString("title"),
            rs.getInt("totalSessions"),
            rs.getInt("remainingSessions"),
            rs.getInt("prepaidAmount"),
            rs.getString("createdAt")
    );

    /** Kalan seans bu sayı veya altındaysa (ve en az 1 ise) paket "bitmek üzere" sayılır. Frontend'deki LOW_PACKAGE_SESSIONS ile aynı olmalı. */
    private static final int LOW_SESSIONS = 2;

    private final JdbcTemplate jdbc;
    private final ClientService clientService;

    public PackageService(JdbcTemplate jdbc, ClientService clientService) {
        this.jdbc = jdbc;
        this.clientService = clientService;
    }

    public List<SessionPackageResponse> list(long userId, long clientId) {
        clientService.requireOwned(userId, clientId);
        return jdbc.query(
                "SELECT * FROM session_packages WHERE clientId = ? ORDER BY remainingSessions DESC, id DESC",
                MAPPER,
                clientId
        );
    }

    /**
     * Bitmek üzere olan paketler. Danışanın kalan seansı LOW_SESSIONS'tan fazla olan başka bir paketi varsa
     * uyarı çıkmaz. Kalan 0 olan (bitmiş) paketler uyarı vermez, aksi halde eski paketler sonsuza kadar görünür.
     */
    public List<ExpiringPackageResponse> listExpiring(long userId) {
        return jdbc.query(
                """
                SELECT p.id, p.clientId, c.name AS clientName, p.title, p.totalSessions, p.remainingSessions
                FROM session_packages p
                INNER JOIN clients c ON c.id = p.clientId
                WHERE c.userId = ?
                  AND p.remainingSessions BETWEEN 1 AND ?
                  AND NOT EXISTS (
                    SELECT 1 FROM session_packages o WHERE o.clientId = p.clientId AND o.remainingSessions > ?
                  )
                ORDER BY p.remainingSessions ASC, c.name ASC
                """,
                (rs, rowNum) -> new ExpiringPackageResponse(
                        rs.getLong("id"),
                        rs.getLong("clientId"),
                        rs.getString("clientName"),
                        rs.getString("title"),
                        rs.getInt("totalSessions"),
                        rs.getInt("remainingSessions")
                ),
                userId,
                LOW_SESSIONS,
                LOW_SESSIONS
        );
    }

    public SessionPackageResponse create(long userId, long clientId, CreatePackageRequest request) {
        clientService.requireOwned(userId, clientId);
        String title = request == null || request.title() == null || request.title().isBlank()
                ? "Seans paketi"
                : request.title().trim();
        int total = request == null || request.totalSessions() == null ? 8 : request.totalSessions();
        if (total < 1 || total > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paket 1 ile 100 seans arasında olmalı.");
        }
        int prepaid = request == null || request.prepaidAmount() == null ? 0 : Math.max(0, request.prepaidAmount());
        Long id = jdbc.queryForObject(
                """
                INSERT INTO session_packages (clientId, title, totalSessions, remainingSessions, prepaidAmount, createdAt, createdBy)
                VALUES (?, ?, ?, ?, ?, utc_now_text(), ?)
                RETURNING id
                """,
                Long.class,
                clientId,
                title,
                total,
                total,
                prepaid,
                userId
        );
        return getOwned(userId, clientId, id == null ? 0L : id);
    }

    public SessionPackageResponse consume(long userId, long clientId, long packageId) {
        SessionPackageResponse pack = getOwned(userId, clientId, packageId);
        if (pack.remainingSessions() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pakette kalan seans yok.");
        }
        jdbc.update(
                "UPDATE session_packages SET remainingSessions = remainingSessions - 1 WHERE id = ? AND remainingSessions > 0",
                packageId
        );
        return getOwned(userId, clientId, packageId);
    }

    public void delete(long userId, long clientId, long packageId) {
        getOwned(userId, clientId, packageId);
        jdbc.update("DELETE FROM session_packages WHERE id = ? AND clientId = ?", packageId, clientId);
    }

    private SessionPackageResponse getOwned(long userId, long clientId, long packageId) {
        clientService.requireOwned(userId, clientId);
        List<SessionPackageResponse> rows = jdbc.query(
                "SELECT * FROM session_packages WHERE id = ? AND clientId = ?",
                MAPPER,
                packageId,
                clientId
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Paket bulunamadı.");
        }
        return rows.get(0);
    }
}
