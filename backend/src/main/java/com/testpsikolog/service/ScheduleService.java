package com.testpsikolog.service;

import com.testpsikolog.dto.BlockedSlotResponse;
import com.testpsikolog.dto.CreateBlockedSlotRequest;
import com.testpsikolog.util.ScheduleInputs;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ScheduleService {

    private static final RowMapper<BlockedSlotResponse> MAPPER = (rs, rowNum) -> new BlockedSlotResponse(
            rs.getLong("id"),
            rs.getString("slotDate"),
            rs.getString("startTime"),
            rs.getString("endTime"),
            rs.getString("title")
    );

    private final JdbcTemplate jdbc;

    public ScheduleService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<BlockedSlotResponse> list(long userId, String from, String to) {
        String start = normalizeDate(from);
        String end = normalizeDate(to);
        if (start == null || end == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tarih aralığı gerekli.");
        }
        return jdbc.query(
                """
                SELECT id, slotDate, startTime, endTime, title
                FROM blocked_slots
                WHERE userId = ? AND slotDate >= ? AND slotDate <= ?
                ORDER BY slotDate ASC, startTime ASC
                """,
                MAPPER,
                userId,
                start,
                end
        );
    }

    @Transactional
    public BlockedSlotResponse create(long userId, CreateBlockedSlotRequest request) {
        String date = ScheduleInputs.requireDate(request.slotDate());
        String startTime = ScheduleInputs.requireTime(request.startTime());
        String endTime = ScheduleInputs.requireTime(request.endTime());
        int start = toMinutes(startTime);
        int end = toMinutes(endTime);
        if (end <= start) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bitiş, başlangıçtan sonra olmalı.");
        }
        if (end - start < 15) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kapalı aralık en az 15 dakika olmalı.");
        }
        if (end > 24 * 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aralık gece yarısını geçemez.");
        }
        lockTherapistSchedule(userId);
        if (overlaps(loadBlockedSlots(userId, date), start, end)
                || overlaps(loadAppointmentSlots(userId, date), start, end)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu saat aralığı dolu veya kapalı.");
        }
        String title = request.title() == null || request.title().isBlank() ? "Kapalı" : request.title().trim();
        Long id = jdbc.queryForObject(
                """
                INSERT INTO blocked_slots (userId, slotDate, startTime, endTime, title, createdAt)
                VALUES (?, ?, ?, ?, ?, utc_now_text())
                RETURNING id
                """,
                Long.class,
                userId,
                date,
                startTime,
                endTime,
                title
        );
        return new BlockedSlotResponse(id == null ? 0L : id, date, startTime, endTime, title);
    }

    public int delete(long userId, long slotId) {
        return jdbc.update("DELETE FROM blocked_slots WHERE id = ? AND userId = ?", slotId, userId);
    }

    public void lockTherapistSchedule(long userId) {
        jdbc.query("SELECT pg_advisory_xact_lock(?)", rs -> null, userId);
    }

    public boolean overlapsBlocked(long userId, String appointmentDate, String appointmentTime, int durationMinutes) {
        String date = normalizeDate(appointmentDate);
        if (date == null) {
            return false;
        }
        int start = toMinutes(appointmentTime);
        int end = start + durationMinutes;
        return overlaps(loadBlockedSlots(userId, date), start, end);
    }

    private List<TimeSlot> loadBlockedSlots(long userId, String slotDate) {
        return jdbc.query(
                """
                SELECT startTime, endTime
                FROM blocked_slots
                WHERE userId = ? AND slotDate = ?
                """,
                (rs, rowNum) -> {
                    int start = toMinutes(rs.getString("startTime"));
                    int end = toMinutes(rs.getString("endTime"));
                    return new TimeSlot(start, Math.max(0, end - start));
                },
                userId,
                slotDate
        );
    }

    private List<TimeSlot> loadAppointmentSlots(long userId, String appointmentDate) {
        return jdbc.query(
                """
                SELECT a.appointmentTime, a.durationMinutes
                FROM appointments a
                INNER JOIN clients c ON a.clientId = c.id
                WHERE c.userId = ? AND a.appointmentDate = ?
                  AND COALESCE(a.status, 'scheduled') != 'cancelled'
                """,
                (rs, rowNum) -> {
                    int duration = rs.getObject("durationMinutes") == null ? 50 : rs.getInt("durationMinutes");
                    return new TimeSlot(toMinutes(rs.getString("appointmentTime")), duration);
                },
                userId,
                appointmentDate
        );
    }

    private static boolean overlaps(List<TimeSlot> slots, int start, int end) {
        for (TimeSlot slot : slots) {
            int otherEnd = slot.start() + slot.durationMinutes();
            if (start < otherEnd && slot.start() < end) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeDate(String d) {
        if (d == null || d.isBlank()) {
            return null;
        }
        String datePart = d.contains("T") ? d.split("T")[0] : d.trim();
        return datePart.length() <= 10 ? datePart : datePart.substring(0, 10);
    }

    private static String normalizeTime(String t) {
        String value = (t == null || t.isBlank()) ? "09:00" : t.trim();
        return value.length() <= 5 ? value : value.substring(0, 5);
    }

    private static int toMinutes(String time) {
        String value = normalizeTime(time);
        int hour = Integer.parseInt(value.substring(0, 2));
        int minute = Integer.parseInt(value.substring(3, 5));
        return hour * 60 + minute;
    }

    private record TimeSlot(int start, int durationMinutes) {
    }
}
