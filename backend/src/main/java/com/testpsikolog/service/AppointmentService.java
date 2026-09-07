package com.testpsikolog.service;

import com.testpsikolog.dto.AppointmentResponse;
import com.testpsikolog.dto.CreateAppointmentRequest;
import com.testpsikolog.dto.UpdateAppointmentRequest;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppointmentService {

    private static final String APPOINTMENT_SELECT =
            """
            SELECT a.*, c.name as clientName, c.agreedFee as agreedFee, c.email as clientEmail,
                   c.userId as therapistUserId,
                   COALESCE(NULLIF(u.email, ''), u.username) as therapistName,
                   r.name as roomName, r.color as roomColor
            FROM appointments a
            INNER JOIN clients c ON a.clientId = c.id
            LEFT JOIN app_users u ON c.userId = u.id
            LEFT JOIN clinic_rooms r ON a.roomId = r.id
            """;

    private static final RowMapper<AppointmentResponse> APPOINTMENT_MAPPER = (rs, rowNum) -> new AppointmentResponse(
            rs.getLong("id"),
            rs.getLong("clientId"),
            rs.getString("appointmentDate"),
            rs.getString("appointmentTime"),
            rs.getString("title"),
            rs.getInt("isPaid"),
            readStatus(rs),
            rs.getString("googleEventId"),
            rs.getString("googleMeetLink"),
            rs.getString("googleHtmlLink"),
            rs.getString("createdAt"),
            rs.getString("updatedAt"),
            columnExists(rs, "clientName") ? rs.getString("clientName") : null,
            columnExists(rs, "agreedFee") && rs.getObject("agreedFee") != null ? rs.getInt("agreedFee") : null,
            columnExists(rs, "clientEmail") ? rs.getString("clientEmail") : null,
            readLong(rs, "clinicId"),
            readLong(rs, "roomId"),
            columnExists(rs, "roomName") ? rs.getString("roomName") : null,
            columnExists(rs, "roomColor") ? rs.getString("roomColor") : null,
            readLong(rs, "therapistUserId"),
            columnExists(rs, "therapistName") ? rs.getString("therapistName") : null,
            true
    );

    private final JdbcTemplate jdbc;
    private final ClientService clientService;
    private final ClinicService clinicService;

    public AppointmentService(JdbcTemplate jdbc, ClientService clientService, ClinicService clinicService) {
        this.jdbc = jdbc;
        this.clientService = clientService;
        this.clinicService = clinicService;
    }

    public long create(long userId, long clientId, CreateAppointmentRequest input) {
        clientService.requireOwned(userId, clientId);
        String dateStr = normalizeDate(input.appointmentDate());
        String timeStr = normalizeTime(input.appointmentTime());
        Long roomId = normalizeRoomId(input.roomId());
        Long clinicId = null;
        if (roomId != null) {
            clinicService.requireOwnedRoom(userId, roomId);
            clinicId = clinicService.clinicIdForUser(userId);
        }
        assertNoConflict(userId, dateStr, timeStr, roomId, null);
        int isPaid = Boolean.TRUE.equals(input.isPaid()) ? 1 : 0;
        String status = normalizeStatus(input.status());
        jdbc.update(
                """
                INSERT INTO appointments (clientId, appointmentDate, appointmentTime, title, isPaid, status, clinicId, roomId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                clientId,
                dateStr,
                timeStr,
                input.title(),
                isPaid,
                status,
                clinicId,
                roomId
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return id == null ? 0L : id;
    }

    public List<AppointmentResponse> getByClientId(long userId, long clientId) {
        clientService.requireOwned(userId, clientId);
        return markMine(
                jdbc.query(
                        APPOINTMENT_SELECT + " WHERE a.clientId = ? ORDER BY a.appointmentDate DESC, a.appointmentTime ASC",
                        APPOINTMENT_MAPPER,
                        clientId
                ),
                userId
        );
    }

    public List<AppointmentResponse> getAll(long userId, String scope) {
        boolean clinicScope = "clinic".equalsIgnoreCase(scope);
        Long clinicId = clinicScope ? clinicService.clinicIdForUser(userId) : null;
        List<AppointmentResponse> rows;
        if (clinicId != null) {
            rows = jdbc.query(
                    APPOINTMENT_SELECT
                            + " WHERE c.userId IN (SELECT userId FROM clinic_members WHERE clinicId = ?)"
                            + " ORDER BY a.appointmentDate ASC, a.appointmentTime ASC",
                    APPOINTMENT_MAPPER,
                    clinicId
            );
        } else {
            rows = jdbc.query(
                    APPOINTMENT_SELECT + " WHERE c.userId = ? ORDER BY a.appointmentDate ASC, a.appointmentTime ASC",
                    APPOINTMENT_MAPPER,
                    userId
            );
        }
        return markMine(rows, userId);
    }

    public AppointmentResponse getByIdWithClient(long userId, long appointmentId) {
        List<AppointmentResponse> rows = jdbc.query(
                APPOINTMENT_SELECT + " WHERE a.id = ? AND c.userId = ?",
                APPOINTMENT_MAPPER,
                appointmentId,
                userId
        );
        if (rows.isEmpty()) {
            return null;
        }
        return markMine(rows, userId).get(0);
    }

    public int update(long userId, long appointmentId, long clientId, UpdateAppointmentRequest data) {
        clientService.requireOwned(userId, clientId);
        List<AppointmentResponse> currentRows = jdbc.query(
                APPOINTMENT_SELECT + " WHERE a.id = ? AND a.clientId = ? AND c.userId = ?",
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
        Long newRoomId = current.roomId();
        Long newClinicId = current.clinicId();
        if (data.roomId() != null) {
            if (data.roomId() == 0L) {
                newRoomId = null;
                newClinicId = clinicService.clinicIdForUser(userId);
            } else {
                clinicService.requireOwnedRoom(userId, data.roomId());
                newRoomId = data.roomId();
                newClinicId = clinicService.clinicIdForUser(userId);
            }
        }
        assertNoConflict(userId, newDate, newTime, newRoomId, appointmentId);
        Integer isPaidVal = data.isPaid() == null ? null : (Boolean.TRUE.equals(data.isPaid()) ? 1 : 0);
        String statusVal = data.status() == null ? null : normalizeStatus(data.status());
        return jdbc.update(
                """
                UPDATE appointments
                SET
                  appointmentDate = COALESCE(?, appointmentDate),
                  appointmentTime = COALESCE(?, appointmentTime),
                  title = COALESCE(?, title),
                  isPaid = CASE WHEN ? IS NOT NULL THEN ? ELSE isPaid END,
                  status = COALESCE(?, status),
                  clinicId = ?,
                  roomId = ?,
                  updatedAt = datetime('now')
                WHERE id = ? AND clientId = ?
                """,
                data.appointmentDate() != null ? newDate : null,
                data.appointmentTime() != null ? newTime : null,
                data.title(),
                isPaidVal,
                isPaidVal,
                statusVal,
                newClinicId,
                newRoomId,
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

    private void assertNoConflict(long userId, String appointmentDate, String appointmentTime, Long roomId, Long excludeId) {
        if (hasTherapistAppointmentAtDateTime(userId, appointmentDate, appointmentTime, excludeId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu tarih ve saatte zaten bir randevunuz var.");
        }
        if (roomId != null && hasRoomAppointmentAtDateTime(roomId, appointmentDate, appointmentTime, excludeId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu oda bu saatte dolu.");
        }
    }

    private boolean hasTherapistAppointmentAtDateTime(long userId, String appointmentDate, String appointmentTime, Long excludeId) {
        String datePattern = appointmentDate + "%";
        String timePattern = appointmentTime + "%";
        if (excludeId != null) {
            Integer existing = jdbc.query(
                    """
                    SELECT a.id FROM appointments a
                    INNER JOIN clients c ON a.clientId = c.id
                    WHERE c.userId = ? AND a.appointmentDate LIKE ? AND a.appointmentTime LIKE ? AND a.id != ?
                      AND COALESCE(a.status, 'scheduled') != 'cancelled'
                    """,
                    rs -> rs.next() ? rs.getInt("id") : null,
                    userId,
                    datePattern,
                    timePattern,
                    excludeId
            );
            return existing != null;
        }
        Integer existing = jdbc.query(
                """
                SELECT a.id FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE c.userId = ? AND a.appointmentDate LIKE ? AND a.appointmentTime LIKE ?
                  AND COALESCE(a.status, 'scheduled') != 'cancelled'
                """,
                rs -> rs.next() ? rs.getInt("id") : null,
                userId,
                datePattern,
                timePattern
        );
        return existing != null;
    }

    private boolean hasRoomAppointmentAtDateTime(long roomId, String appointmentDate, String appointmentTime, Long excludeId) {
        String datePattern = appointmentDate + "%";
        String timePattern = appointmentTime + "%";
        if (excludeId != null) {
            Integer existing = jdbc.query(
                    """
                    SELECT a.id FROM appointments a
                    WHERE a.roomId = ? AND a.appointmentDate LIKE ? AND a.appointmentTime LIKE ? AND a.id != ?
                      AND COALESCE(a.status, 'scheduled') != 'cancelled'
                    """,
                    rs -> rs.next() ? rs.getInt("id") : null,
                    roomId,
                    datePattern,
                    timePattern,
                    excludeId
            );
            return existing != null;
        }
        Integer existing = jdbc.query(
                """
                SELECT a.id FROM appointments a
                WHERE a.roomId = ? AND a.appointmentDate LIKE ? AND a.appointmentTime LIKE ?
                  AND COALESCE(a.status, 'scheduled') != 'cancelled'
                """,
                rs -> rs.next() ? rs.getInt("id") : null,
                roomId,
                datePattern,
                timePattern
        );
        return existing != null;
    }

    private static List<AppointmentResponse> markMine(List<AppointmentResponse> rows, long userId) {
        List<AppointmentResponse> result = new ArrayList<>();
        for (AppointmentResponse row : rows) {
            boolean mine = row.therapistUserId() != null && row.therapistUserId() == userId;
            if (mine) {
                result.add(withMine(row, true));
            } else {
                result.add(new AppointmentResponse(
                        row.id(),
                        0,
                        row.appointmentDate(),
                        row.appointmentTime(),
                        "Seans",
                        0,
                        row.status(),
                        null,
                        null,
                        null,
                        row.createdAt(),
                        row.updatedAt(),
                        null,
                        null,
                        null,
                        row.clinicId(),
                        row.roomId(),
                        row.roomName(),
                        row.roomColor(),
                        row.therapistUserId(),
                        row.therapistName(),
                        false
                ));
            }
        }
        return result;
    }

    private static AppointmentResponse withMine(AppointmentResponse row, boolean mine) {
        return new AppointmentResponse(
                row.id(),
                row.clientId(),
                row.appointmentDate(),
                row.appointmentTime(),
                row.title(),
                row.isPaid(),
                row.status(),
                row.googleEventId(),
                row.googleMeetLink(),
                row.googleHtmlLink(),
                row.createdAt(),
                row.updatedAt(),
                row.clientName(),
                row.agreedFee(),
                row.clientEmail(),
                row.clinicId(),
                row.roomId(),
                row.roomName(),
                row.roomColor(),
                row.therapistUserId(),
                row.therapistName(),
                mine
        );
    }

    private static Long normalizeRoomId(Long roomId) {
        if (roomId == null || roomId == 0L) {
            return null;
        }
        return roomId;
    }

    private static String readStatus(java.sql.ResultSet rs) throws java.sql.SQLException {
        if (!columnExists(rs, "status")) {
            return "scheduled";
        }
        String value = rs.getString("status");
        return normalizeStatus(value);
    }

    private static Long readLong(java.sql.ResultSet rs, String label) throws java.sql.SQLException {
        if (!columnExists(rs, label) || rs.getObject(label) == null) {
            return null;
        }
        return rs.getLong(label);
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "scheduled";
        }
        String value = status.trim().toLowerCase();
        if (value.equals("attended") || value.equals("no_show") || value.equals("cancelled")) {
            return value;
        }
        return "scheduled";
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
