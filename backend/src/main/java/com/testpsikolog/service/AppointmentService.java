package com.testpsikolog.service;

import com.testpsikolog.dto.AppointmentResponse;
import com.testpsikolog.dto.CreateAppointmentRequest;
import com.testpsikolog.dto.UpdateAppointmentRequest;
import com.testpsikolog.util.AttachmentFiles;
import com.testpsikolog.util.ScheduleInputs;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppointmentService {

    private static final String CANCELLED = "cancelled";

    private static final String APPOINTMENT_SELECT =
            """
            SELECT a.*, c.name as clientName, c.agreedFee as agreedFee, c.email as clientEmail,
                   c.userId as therapistUserId,
                   COALESCE(NULLIF(u.displayName, ''), NULLIF(u.email, ''), u.username) as therapistName,
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
            readDuration(rs),
            columnExists(rs, "seriesId") ? rs.getString("seriesId") : null,
            readInt(rs, "sessionFee"),
            true
    );

    private final JdbcTemplate jdbc;
    private final ClientService clientService;
    private final ClinicService clinicService;
    private final ScheduleService scheduleService;

    public AppointmentService(
            JdbcTemplate jdbc,
            ClientService clientService,
            ClinicService clinicService,
            ScheduleService scheduleService
    ) {
        this.jdbc = jdbc;
        this.clientService = clientService;
        this.clinicService = clinicService;
        this.scheduleService = scheduleService;
    }

    @Transactional
    public List<Long> create(long userId, long clientId, CreateAppointmentRequest input) {
        clientService.requireOwned(userId, clientId);
        String dateStr = ScheduleInputs.requireDate(input.appointmentDate());
        String timeStr = input.appointmentTime() == null || input.appointmentTime().isBlank()
                ? "09:00"
                : ScheduleInputs.requireTime(input.appointmentTime());
        int duration = ScheduleInputs.requireDuration(input.durationMinutes());
        Integer sessionFee = ScheduleInputs.requireNonNegativeFee(input.sessionFee());
        Long roomId = normalizeRoomId(input.roomId());
        Long clinicId = null;
        if (roomId != null) {
            clinicService.requireOwnedRoom(userId, roomId);
            clinicId = clinicService.clinicIdForUser(userId);
        }
        int isPaid = Boolean.TRUE.equals(input.isPaid()) ? 1 : 0;
        String status = normalizeStatus(input.status());
        if (!CANCELLED.equals(status)) {
            assertNoConflict(userId, dateStr, timeStr, duration, roomId, null);
        }
        jdbc.update(
                """
                INSERT INTO appointments (
                  clientId, appointmentDate, appointmentTime, title, isPaid, status,
                  clinicId, roomId, durationMinutes, sessionFee, createdAt, updatedAt
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                clientId,
                dateStr,
                timeStr,
                blankToNull(input.title()),
                isPaid,
                status,
                clinicId,
                roomId,
                duration,
                sessionFee
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return List.of(id == null ? 0L : id);
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

    public List<AppointmentResponse> getUpcoming(long userId, int hours) {
        int window = hours <= 0 ? 24 : Math.min(hours, 72);
        List<AppointmentResponse> mine = getAll(userId, null);
        ZoneId zone = ZoneId.of("Europe/Istanbul");
        ZonedDateTime now = ZonedDateTime.now(zone);
        ZonedDateTime until = now.plusHours(window);
        List<AppointmentResponse> upcoming = new ArrayList<>();
        for (AppointmentResponse apt : mine) {
            if (!"scheduled".equals(normalizeStatus(apt.status()))) {
                continue;
            }
            try {
                LocalDate date = parseDate(apt.appointmentDate());
                String time = normalizeTime(apt.appointmentTime());
                ZonedDateTime start = LocalDateTime.parse(date + "T" + time).atZone(zone);
                if (!start.isBefore(now) && !start.isAfter(until)) {
                    upcoming.add(apt);
                }
            } catch (Exception ignored) {
            }
        }
        return upcoming;
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
        String currentDate = normalizeDate(current.appointmentDate());
        String currentTime = normalizeTime(current.appointmentTime());
        String newDate = data.appointmentDate() != null
                ? ScheduleInputs.requireDate(data.appointmentDate())
                : currentDate;
        String newTime = data.appointmentTime() != null
                ? ScheduleInputs.requireTime(data.appointmentTime())
                : currentTime;
        int newDuration = data.durationMinutes() != null
                ? ScheduleInputs.requireDuration(data.durationMinutes())
                : current.durationMinutes();
        ScheduleInputs.requireNonNegativeFee(data.sessionFee());
        Long newRoomId = current.roomId();
        Long newClinicId = current.clinicId();
        Long requestedRoomId = data.roomId() == null ? current.roomId() : normalizeRoomId(data.roomId());
        if (!Objects.equals(requestedRoomId, current.roomId())) {
            if (requestedRoomId != null) {
                clinicService.requireOwnedRoom(userId, requestedRoomId);
            }
            newRoomId = requestedRoomId;
            newClinicId = clinicService.clinicIdForUser(userId);
        }
        String currentStatus = normalizeStatus(current.status());
        String newStatus = data.status() == null ? currentStatus : normalizeStatus(data.status());
        boolean willBeActive = !CANCELLED.equals(newStatus);
        boolean scheduleChanged = !newDate.equals(currentDate)
                || !newTime.equals(currentTime)
                || newDuration != current.durationMinutes()
                || !Objects.equals(newRoomId, current.roomId());
        boolean reactivated = CANCELLED.equals(currentStatus) && willBeActive;
        if (willBeActive && (scheduleChanged || reactivated)) {
            assertNoConflict(userId, newDate, newTime, newDuration, newRoomId, appointmentId);
        }
        Integer isPaidVal = data.isPaid() == null ? null : (Boolean.TRUE.equals(data.isPaid()) ? 1 : 0);
        String statusVal = data.status() == null ? null : newStatus;
        Integer durationVal = data.durationMinutes() == null ? null : newDuration;
        boolean titleProvided = data.title() != null;
        boolean clearSessionFee = Boolean.TRUE.equals(data.clearSessionFee());
        boolean sessionFeeProvided = clearSessionFee || data.sessionFee() != null;
        return jdbc.update(
                """
                UPDATE appointments
                SET
                  appointmentDate = COALESCE(?, appointmentDate),
                  appointmentTime = COALESCE(?, appointmentTime),
                  title = CASE WHEN ? = 1 THEN ? ELSE title END,
                  isPaid = CASE WHEN ? IS NOT NULL THEN ? ELSE isPaid END,
                  status = COALESCE(?, status),
                  clinicId = ?,
                  roomId = ?,
                  durationMinutes = COALESCE(?, durationMinutes),
                  sessionFee = CASE WHEN ? = 1 THEN ? ELSE sessionFee END,
                  updatedAt = datetime('now')
                WHERE id = ? AND clientId = ?
                """,
                data.appointmentDate() != null ? newDate : null,
                data.appointmentTime() != null ? newTime : null,
                titleProvided ? 1 : 0,
                blankToNull(data.title()),
                isPaidVal,
                isPaidVal,
                statusVal,
                newClinicId,
                newRoomId,
                durationVal,
                sessionFeeProvided ? 1 : 0,
                clearSessionFee ? null : data.sessionFee(),
                appointmentId,
                clientId
        );
    }

    @Transactional
    public int delete(long userId, long appointmentId, long clientId) {
        clientService.requireOwned(userId, clientId);
        List<String> attachmentPaths = jdbc.query(
                """
                SELECT filePath FROM client_notes
                WHERE appointmentId = ? AND clientId = ? AND filePath IS NOT NULL AND filePath <> ''
                """,
                (rs, rowNum) -> rs.getString("filePath"),
                appointmentId,
                clientId
        );
        int deleted = jdbc.update(
                """
                DELETE FROM appointments
                WHERE id = ? AND clientId = ?
                  AND clientId IN (SELECT id FROM clients WHERE userId = ?)
                """,
                appointmentId,
                clientId,
                userId
        );
        if (deleted == 0) {
            return 0;
        }
        jdbc.update("DELETE FROM client_notes WHERE appointmentId = ? AND clientId = ?", appointmentId, clientId);
        AttachmentFiles.deleteQuietly(attachmentPaths);
        return deleted;
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

    private void assertNoConflict(
            long userId,
            String appointmentDate,
            String appointmentTime,
            int durationMinutes,
            Long roomId,
            Long excludeId
    ) {
        int start = toMinutes(appointmentTime);
        if (start + durationMinutes > 24 * 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seans gece yarısını geçemez.");
        }
        if (hasOverlap(loadTherapistSlots(userId, appointmentDate, excludeId), appointmentTime, durationMinutes)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu saat aralığında zaten bir randevunuz var.");
        }
        if (roomId != null && hasOverlap(loadRoomSlots(roomId, appointmentDate, excludeId), appointmentTime, durationMinutes)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu oda bu saat aralığında dolu.");
        }
        if (scheduleService.overlapsBlocked(userId, appointmentDate, appointmentTime, durationMinutes)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu saat kapalı.");
        }
    }

    private List<TimeSlot> loadTherapistSlots(long userId, String appointmentDate, Long excludeId) {
        return jdbc.query(
                """
                SELECT a.id, a.appointmentTime, a.durationMinutes
                FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE c.userId = ? AND a.appointmentDate LIKE ?
                  AND COALESCE(a.status, 'scheduled') != 'cancelled'
                  AND (? IS NULL OR a.id != ?)
                """,
                (rs, rowNum) -> new TimeSlot(rs.getString("appointmentTime"), readDuration(rs)),
                userId,
                appointmentDate + "%",
                excludeId,
                excludeId
        );
    }

    private List<TimeSlot> loadRoomSlots(long roomId, String appointmentDate, Long excludeId) {
        return jdbc.query(
                """
                SELECT a.id, a.appointmentTime, a.durationMinutes
                FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                INNER JOIN clinic_rooms r ON r.id = a.roomId
                INNER JOIN clinic_members m ON m.clinicId = r.clinicId AND m.userId = c.userId
                WHERE a.roomId = ? AND a.appointmentDate LIKE ?
                  AND COALESCE(a.status, 'scheduled') != 'cancelled'
                  AND (? IS NULL OR a.id != ?)
                """,
                (rs, rowNum) -> new TimeSlot(rs.getString("appointmentTime"), readDuration(rs)),
                roomId,
                appointmentDate + "%",
                excludeId,
                excludeId
        );
    }

    private static boolean hasOverlap(List<TimeSlot> slots, String appointmentTime, int durationMinutes) {
        int start = toMinutes(appointmentTime);
        int end = start + durationMinutes;
        for (TimeSlot slot : slots) {
            int otherStart = toMinutes(slot.time());
            int otherEnd = otherStart + slot.durationMinutes();
            if (start < otherEnd && otherStart < end) {
                return true;
            }
        }
        return false;
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
                        row.durationMinutes(),
                        null,
                        null,
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
                row.durationMinutes(),
                row.seriesId(),
                row.sessionFee(),
                mine
        );
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
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

    private static int readDuration(java.sql.ResultSet rs) throws java.sql.SQLException {
        if (!columnExists(rs, "durationMinutes") || rs.getObject("durationMinutes") == null) {
            return 50;
        }
        return normalizeDuration(rs.getInt("durationMinutes"));
    }

    private static Long readLong(java.sql.ResultSet rs, String label) throws java.sql.SQLException {
        if (!columnExists(rs, label) || rs.getObject(label) == null) {
            return null;
        }
        return rs.getLong(label);
    }

    private static Integer readInt(java.sql.ResultSet rs, String label) throws java.sql.SQLException {
        if (!columnExists(rs, label) || rs.getObject(label) == null) {
            return null;
        }
        return rs.getInt(label);
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

    private static int normalizeDuration(Integer minutes) {
        if (minutes == null) {
            return 50;
        }
        if (minutes < 15 || minutes > 240 || minutes % 5 != 0) {
            return 50;
        }
        return minutes;
    }

    private static LocalDate parseDate(String d) {
        try {
            return LocalDate.parse(normalizeDate(d));
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir tarih girin.");
        }
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

    private static int toMinutes(String time) {
        String value = normalizeTime(time);
        int hour = Integer.parseInt(value.substring(0, 2));
        int minute = Integer.parseInt(value.substring(3, 5));
        return hour * 60 + minute;
    }

    private static boolean columnExists(java.sql.ResultSet rs, String label) {
        try {
            rs.findColumn(label);
            return true;
        } catch (java.sql.SQLException ex) {
            return false;
        }
    }

    private record TimeSlot(String time, int durationMinutes) {
    }
}
