package com.testpsikolog.service;

import com.testpsikolog.dto.AppointmentResponse;
import com.testpsikolog.dto.CreateAppointmentRequest;
import com.testpsikolog.dto.UpdateAppointmentRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppointmentService {

    private static final RowMapper<AppointmentResponse> APPOINTMENT_MAPPER = (rs, rowNum) -> new AppointmentResponse(
            rs.getLong("id"),
            rs.getLong("clientId"),
            rs.getString("appointmentDate"),
            rs.getString("appointmentTime"),
            rs.getString("title"),
            rs.getInt("isPaid"),
            rs.getString("googleEventId"),
            rs.getString("googleMeetLink"),
            rs.getString("googleHtmlLink"),
            rs.getString("createdAt"),
            rs.getString("updatedAt"),
            columnExists(rs, "clientName") ? rs.getString("clientName") : null,
            columnExists(rs, "agreedFee") && rs.getObject("agreedFee") != null ? rs.getInt("agreedFee") : null,
            columnExists(rs, "clientEmail") ? rs.getString("clientEmail") : null
    );

    private final JdbcTemplate jdbc;
    private final ClientService clientService;

    public AppointmentService(JdbcTemplate jdbc, ClientService clientService) {
        this.jdbc = jdbc;
        this.clientService = clientService;
    }

    public long create(long userId, long clientId, CreateAppointmentRequest input) {
        clientService.requireOwned(userId, clientId);
        String dateStr = normalizeDate(input.appointmentDate());
        String timeStr = normalizeTime(input.appointmentTime());
        if (hasAppointmentAtDateTime(userId, dateStr, timeStr, null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu tarih ve saatte zaten bir randevu mevcut.");
        }
        int isPaid = Boolean.TRUE.equals(input.isPaid()) ? 1 : 0;
        jdbc.update(
                """
                INSERT INTO appointments (clientId, appointmentDate, appointmentTime, title, isPaid, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                clientId,
                dateStr,
                timeStr,
                input.title(),
                isPaid
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return id == null ? 0L : id;
    }

    public List<AppointmentResponse> getByClientId(long userId, long clientId) {
        clientService.requireOwned(userId, clientId);
        return jdbc.query(
                """
                SELECT a.*, c.name as clientName, c.agreedFee as agreedFee, c.email as clientEmail
                FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE a.clientId = ?
                ORDER BY a.appointmentDate DESC, a.appointmentTime ASC
                """,
                APPOINTMENT_MAPPER,
                clientId
        );
    }

    public List<AppointmentResponse> getAll(long userId) {
        return jdbc.query(
                """
                SELECT a.*, c.name as clientName, c.agreedFee as agreedFee, c.email as clientEmail
                FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE c.userId = ?
                ORDER BY a.appointmentDate ASC, a.appointmentTime ASC
                """,
                APPOINTMENT_MAPPER,
                userId
        );
    }

    public AppointmentResponse getByIdWithClient(long userId, long appointmentId) {
        List<AppointmentResponse> rows = jdbc.query(
                """
                SELECT a.*, c.name as clientName, c.agreedFee as agreedFee, c.email as clientEmail
                FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE a.id = ? AND c.userId = ?
                """,
                APPOINTMENT_MAPPER,
                appointmentId,
                userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public int update(long userId, long appointmentId, long clientId, UpdateAppointmentRequest data) {
        clientService.requireOwned(userId, clientId);
        List<AppointmentResponse> currentRows = jdbc.query(
                """
                SELECT a.* FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE a.id = ? AND a.clientId = ? AND c.userId = ?
                """,
                APPOINTMENT_MAPPER,
                appointmentId,
                clientId,
                userId
        );
        if (currentRows.isEmpty()) {
            return 0;
        }
        AppointmentResponse current = currentRows.get(0);
        String newDate = data.appointmentDate() != null
                ? normalizeDate(data.appointmentDate())
                : normalizeDate(current.appointmentDate());
        String newTime = data.appointmentTime() != null
                ? normalizeTime(data.appointmentTime())
                : normalizeTime(current.appointmentTime());
        if (hasAppointmentAtDateTime(userId, newDate, newTime, appointmentId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu tarih ve saatte zaten bir randevu mevcut.");
        }
        Integer isPaidVal = data.isPaid() == null ? null : (Boolean.TRUE.equals(data.isPaid()) ? 1 : 0);
        return jdbc.update(
                """
                UPDATE appointments
                SET
                  appointmentDate = COALESCE(?, appointmentDate),
                  appointmentTime = COALESCE(?, appointmentTime),
                  title = COALESCE(?, title),
                  isPaid = CASE WHEN ? IS NOT NULL THEN ? ELSE isPaid END,
                  updatedAt = datetime('now')
                WHERE id = ? AND clientId = ?
                """,
                data.appointmentDate() != null ? newDate : null,
                data.appointmentTime() != null ? newTime : null,
                data.title(),
                isPaidVal,
                isPaidVal,
                appointmentId,
                clientId
        );
    }

    public int delete(long userId, long appointmentId, long clientId) {
        clientService.requireOwned(userId, clientId);
        return jdbc.update(
                """
                DELETE FROM appointments
                WHERE id = ? AND clientId = ?
                  AND clientId IN (SELECT id FROM clients WHERE userId = ?)
                """,
                appointmentId,
                clientId,
                userId
        );
    }

    public int updateGoogleFields(long userId, long appointmentId, String eventId, String meetLink, String htmlLink) {
        AppointmentResponse owned = getByIdWithClient(userId, appointmentId);
        if (owned == null) {
            return 0;
        }
        return jdbc.update(
                """
                UPDATE appointments
                SET googleEventId = ?, googleMeetLink = ?, googleHtmlLink = ?, updatedAt = datetime('now')
                WHERE id = ?
                """,
                eventId,
                meetLink,
                htmlLink,
                appointmentId
        );
    }

    private boolean hasAppointmentAtDateTime(long userId, String appointmentDate, String appointmentTime, Long excludeId) {
        String datePattern = appointmentDate + "%";
        String timePattern = appointmentTime + "%";
        Integer existing;
        if (excludeId != null) {
            existing = jdbc.query(
                    """
                    SELECT a.id FROM appointments a
                    INNER JOIN clients c ON a.clientId = c.id
                    WHERE c.userId = ? AND a.appointmentDate LIKE ? AND a.appointmentTime LIKE ? AND a.id != ?
                    """,
                    rs -> rs.next() ? rs.getInt("id") : null,
                    userId,
                    datePattern,
                    timePattern,
                    excludeId
            );
        } else {
            existing = jdbc.query(
                    """
                    SELECT a.id FROM appointments a
                    INNER JOIN clients c ON a.clientId = c.id
                    WHERE c.userId = ? AND a.appointmentDate LIKE ? AND a.appointmentTime LIKE ?
                    """,
                    rs -> rs.next() ? rs.getInt("id") : null,
                    userId,
                    datePattern,
                    timePattern
            );
        }
        return existing != null;
    }

    private static String normalizeDate(String d) {
        if (d == null || d.isBlank()) {
            return d;
        }
        String datePart = d.contains("T") ? d.split("T")[0] : d;
        return datePart.length() <= 10 ? datePart : datePart.substring(0, 10);
    }

    private static String normalizeTime(String t) {
        String value = (t == null || t.isBlank()) ? "09:00" : t;
        return value.length() <= 5 ? value : value.substring(0, 5);
    }

    private static boolean columnExists(java.sql.ResultSet rs, String label) {
        try {
            rs.findColumn(label);
            return true;
        } catch (java.sql.SQLException ex) {
            return false;
        }
    }
}
