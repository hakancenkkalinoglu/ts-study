package com.testpsikolog.service;

import com.testpsikolog.dto.ClinicMemberResponse;
import com.testpsikolog.dto.ClinicOverviewResponse;
import com.testpsikolog.dto.ClinicOverviewResponse.RoomOverview;
import com.testpsikolog.dto.ClinicOverviewResponse.TherapistOverview;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.ClinicRoomResponse;
import com.testpsikolog.util.ScheduleInputs;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Kliniğin para içermeyen genel durumu: psikolog başına seans, oda ve gün; oda başına doluluk. */
@Service
public class ClinicOverviewService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");

    private final JdbcTemplate jdbc;
    private final ClinicService clinicService;

    public ClinicOverviewService(JdbcTemplate jdbc, ClinicService clinicService) {
        this.jdbc = jdbc;
        this.clinicService = clinicService;
    }

    public ClinicOverviewResponse overview(long userId, String from, String to) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.VIEW_CLINIC_SCHEDULE);
        String start = from == null || from.isBlank() ? monthStart() : ScheduleInputs.requireDate(from);
        String end = to == null || to.isBlank() ? monthEnd() : ScheduleInputs.requireDate(to);

        List<Row> rows = jdbc.query(
                """
                SELECT a.appointmentDate, COALESCE(a.status, 'scheduled') AS status,
                       COALESCE(a.durationMinutes, 50) AS minutes, a.roomId, c.userId AS therapistId
                FROM appointments a
                INNER JOIN clients c ON c.id = a.clientId
                WHERE a.clinicId = ? AND a.appointmentDate BETWEEN ? AND ?
                """,
                (rs, rowNum) -> new Row(
                        rs.getString("appointmentDate"),
                        rs.getString("status"),
                        rs.getInt("minutes"),
                        (Long) rs.getObject("roomId"),
                        rs.getLong("therapistId")
                ),
                clinic.id(),
                start,
                end
        );

        Map<Long, String> roomNames = new LinkedHashMap<>();
        Map<Long, RoomAcc> roomAcc = new LinkedHashMap<>();
        for (ClinicRoomResponse room : clinic.rooms()) {
            roomNames.put(room.id(), room.name());
            roomAcc.put(room.id(), new RoomAcc(room));
        }
        Map<Long, TherapistAcc> therapists = new LinkedHashMap<>();
        for (ClinicMemberResponse member : clinic.members()) {
            therapists.put(member.userId(), new TherapistAcc(member));
        }

        int sessions = 0;
        int cancelled = 0;
        int noShow = 0;
        for (Row row : rows) {
            TherapistAcc therapist = therapists.get(row.therapistId());
            if (therapist == null) {
                continue;
            }
            if ("cancelled".equals(row.status())) {
                therapist.cancelled++;
                cancelled++;
                continue;
            }
            therapist.sessions++;
            sessions++;
            if ("no_show".equals(row.status())) {
                therapist.noShow++;
                noShow++;
            }
            therapist.weekdays.add(LocalDate.parse(row.date().substring(0, 10)).getDayOfWeek().getValue());
            RoomAcc room = row.roomId() == null ? null : roomAcc.get(row.roomId());
            if (room != null) {
                room.sessions++;
                room.minutes += row.minutes();
                therapist.rooms.add(roomNames.get(row.roomId()));
            }
        }

        List<TherapistOverview> therapistRows = new ArrayList<>();
        for (TherapistAcc acc : therapists.values()) {
            therapistRows.add(new TherapistOverview(
                    acc.member.userId(),
                    acc.member.name(),
                    acc.member.role(),
                    acc.sessions,
                    acc.cancelled,
                    acc.noShow,
                    List.copyOf(acc.rooms),
                    List.copyOf(acc.weekdays)
            ));
        }
        List<RoomOverview> roomRows = new ArrayList<>();
        for (RoomAcc acc : roomAcc.values()) {
            roomRows.add(new RoomOverview(acc.room.id(), acc.room.name(), acc.room.color(), acc.sessions, acc.minutes));
        }
        return new ClinicOverviewResponse(start, end, sessions, cancelled, noShow, therapistRows, roomRows);
    }

    private static String monthStart() {
        return LocalDate.now(ZONE).withDayOfMonth(1).toString();
    }

    private static String monthEnd() {
        LocalDate today = LocalDate.now(ZONE);
        return today.withDayOfMonth(today.lengthOfMonth()).toString();
    }

    private record Row(String date, String status, int minutes, Long roomId, long therapistId) {
    }

    private static final class TherapistAcc {
        final ClinicMemberResponse member;
        int sessions;
        int cancelled;
        int noShow;
        final TreeSet<String> rooms = new TreeSet<>();
        final TreeSet<Integer> weekdays = new TreeSet<>();

        TherapistAcc(ClinicMemberResponse member) {
            this.member = member;
        }
    }

    private static final class RoomAcc {
        final ClinicRoomResponse room;
        int sessions;
        int minutes;

        RoomAcc(ClinicRoomResponse room) {
            this.room = room;
        }
    }
}
