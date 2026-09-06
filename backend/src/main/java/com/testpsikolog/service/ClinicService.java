package com.testpsikolog.service;

import com.testpsikolog.dto.ClinicMemberResponse;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.ClinicRoomResponse;
import com.testpsikolog.dto.CreateClinicRequest;
import com.testpsikolog.dto.CreateRoomRequest;
import com.testpsikolog.dto.JoinClinicRequest;
import com.testpsikolog.dto.UpdateRoomRequest;
import java.security.SecureRandom;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClinicService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String[] DEFAULT_ROOM_COLORS = {"#4f46e5", "#0f766e", "#c2410c", "#7c3aed"};
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final RowMapper<ClinicRoomResponse> ROOM_MAPPER = (rs, rowNum) -> new ClinicRoomResponse(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("color")
    );

    private final JdbcTemplate jdbc;

    public ClinicService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ClinicResponse getMine(long userId) {
        Long clinicId = clinicIdForUser(userId);
        if (clinicId == null) {
            return null;
        }
        return loadClinic(clinicId, userId);
    }

    public Long clinicIdForUser(long userId) {
        return jdbc.query(
                "SELECT clinicId FROM clinic_members WHERE userId = ?",
                rs -> rs.next() ? rs.getLong("clinicId") : null,
                userId
        );
    }

    public ClinicRoomResponse requireOwnedRoom(long userId, Long roomId) {
        if (roomId == null) {
            return null;
        }
        Long clinicId = clinicIdForUser(userId);
        if (clinicId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Önce bir kliniğe katılın veya klinik oluşturun.");
        }
        List<ClinicRoomResponse> rooms = jdbc.query(
                "SELECT id, name, color FROM clinic_rooms WHERE id = ? AND clinicId = ?",
                ROOM_MAPPER,
                roomId,
                clinicId
        );
        if (rooms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Oda bu kliniğe ait değil.");
        }
        return rooms.get(0);
    }

    public ClinicResponse create(long userId, CreateClinicRequest request) {
        if (clinicIdForUser(userId) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Zaten bir kliniğe bağlısınız.");
        }
        String name = requireName(request == null ? null : request.name(), "Klinik adı gerekli.");
        String code = newInviteCode();
        jdbc.update(
                "INSERT INTO clinics (name, inviteCode, ownerUserId, createdAt) VALUES (?, ?, ?, datetime('now'))",
                name,
                code,
                userId
        );
        Long clinicId = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        if (clinicId == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Klinik oluşturulamadı.");
        }
        jdbc.update(
                "INSERT INTO clinic_members (clinicId, userId, role, createdAt) VALUES (?, ?, 'owner', datetime('now'))",
                clinicId,
                userId
        );
        jdbc.update(
                "INSERT INTO clinic_rooms (clinicId, name, color, createdAt) VALUES (?, 'Oda 1', ?, datetime('now'))",
                clinicId,
                DEFAULT_ROOM_COLORS[0]
        );
        jdbc.update(
                "INSERT INTO clinic_rooms (clinicId, name, color, createdAt) VALUES (?, 'Online', ?, datetime('now'))",
                clinicId,
                DEFAULT_ROOM_COLORS[1]
        );
        return loadClinic(clinicId, userId);
    }

    public ClinicResponse join(long userId, JoinClinicRequest request) {
        if (clinicIdForUser(userId) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Zaten bir kliniğe bağlısınız.");
        }
        String code = request == null || request.inviteCode() == null ? "" : request.inviteCode().trim().toUpperCase();
        if (code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Davet kodu gerekli.");
        }
        Long clinicId = jdbc.query(
                "SELECT id FROM clinics WHERE inviteCode = ?",
                rs -> rs.next() ? rs.getLong("id") : null,
                code
        );
        if (clinicId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Davet kodu bulunamadı.");
        }
        jdbc.update(
                "INSERT INTO clinic_members (clinicId, userId, role, createdAt) VALUES (?, ?, 'member', datetime('now'))",
                clinicId,
                userId
        );
        return loadClinic(clinicId, userId);
    }

    public void leave(long userId) {
        ClinicResponse clinic = getMine(userId);
        if (clinic == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
        }
        if ("owner".equals(clinic.role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kurucu ayrılamaz. Kliniği silin veya başka birine bırakın.");
        }
        jdbc.update("DELETE FROM clinic_members WHERE clinicId = ? AND userId = ?", clinic.id(), userId);
    }

    public void deleteClinic(long userId) {
        ClinicResponse clinic = getMine(userId);
        if (clinic == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
        }
        if (!"owner".equals(clinic.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Kliniği sadece kurucu silebilir.");
        }
        jdbc.update("UPDATE appointments SET clinicId = NULL, roomId = NULL WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinic_rooms WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinic_members WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinics WHERE id = ?", clinic.id());
    }

    public ClinicRoomResponse addRoom(long userId, CreateRoomRequest request) {
        Long clinicId = requireClinicId(userId);
        String name = requireName(request == null ? null : request.name(), "Oda adı gerekli.");
        String color = normalizeColor(request == null ? null : request.color(), nextRoomColor(clinicId));
        jdbc.update(
                "INSERT INTO clinic_rooms (clinicId, name, color, createdAt) VALUES (?, ?, ?, datetime('now'))",
                clinicId,
                name,
                color
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return new ClinicRoomResponse(id == null ? 0L : id, name, color);
    }

    public ClinicRoomResponse updateRoom(long userId, long roomId, UpdateRoomRequest request) {
        requireOwnedRoom(userId, roomId);
        String name = request == null ? null : blankToNull(request.name());
        String color = request == null ? null : blankToNull(request.color());
        if (name == null && color == null) {
            return requireOwnedRoom(userId, roomId);
        }
        jdbc.update(
                """
                UPDATE clinic_rooms
                SET name = COALESCE(?, name), color = COALESCE(?, color)
                WHERE id = ?
                """,
                name,
                color == null ? null : normalizeColor(color, color),
                roomId
        );
        return requireOwnedRoom(userId, roomId);
    }

    public void deleteRoom(long userId, long roomId) {
        requireOwnedRoom(userId, roomId);
        jdbc.update("UPDATE appointments SET roomId = NULL WHERE roomId = ?", roomId);
        jdbc.update("DELETE FROM clinic_rooms WHERE id = ?", roomId);
    }

    public List<ClinicRoomResponse> listRooms(long userId) {
        Long clinicId = clinicIdForUser(userId);
        if (clinicId == null) {
            return List.of();
        }
        return jdbc.query(
                "SELECT id, name, color FROM clinic_rooms WHERE clinicId = ? ORDER BY id ASC",
                ROOM_MAPPER,
                clinicId
        );
    }

    private Long requireClinicId(long userId) {
        Long clinicId = clinicIdForUser(userId);
        if (clinicId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
        }
        return clinicId;
    }

    private ClinicResponse loadClinic(long clinicId, long userId) {
        List<ClinicResponse> headers = jdbc.query(
                "SELECT id, name, inviteCode, ownerUserId FROM clinics WHERE id = ?",
                (rs, rowNum) -> new ClinicResponse(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("inviteCode"),
                        rs.getLong("ownerUserId"),
                        "",
                        List.of(),
                        List.of()
                ),
                clinicId
        );
        if (headers.isEmpty()) {
            return null;
        }
        ClinicResponse header = headers.get(0);
        String role = jdbc.query(
                "SELECT role FROM clinic_members WHERE clinicId = ? AND userId = ?",
                rs -> rs.next() ? rs.getString("role") : "member",
                clinicId,
                userId
        );
        List<ClinicMemberResponse> members = jdbc.query(
                """
                SELECT m.userId, m.role, COALESCE(NULLIF(u.email, ''), u.username) AS name
                FROM clinic_members m
                INNER JOIN app_users u ON u.id = m.userId
                WHERE m.clinicId = ?
                ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, name ASC
                """,
                (rs, rowNum) -> new ClinicMemberResponse(
                        rs.getLong("userId"),
                        rs.getString("name"),
                        rs.getString("role")
                ),
                clinicId
        );
        List<ClinicRoomResponse> rooms = jdbc.query(
                "SELECT id, name, color FROM clinic_rooms WHERE clinicId = ? ORDER BY id ASC",
                ROOM_MAPPER,
                clinicId
        );
        return new ClinicResponse(
                header.id(),
                header.name(),
                header.inviteCode(),
                header.ownerUserId(),
                role,
                members,
                rooms
        );
    }

    private String newInviteCode() {
        for (int attempt = 0; attempt < 8; attempt++) {
            StringBuilder code = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                code.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String value = code.toString();
            Integer exists = jdbc.query(
                    "SELECT id FROM clinics WHERE inviteCode = ?",
                    rs -> rs.next() ? 1 : null,
                    value
            );
            if (exists == null) {
                return value;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Davet kodu üretilemedi.");
    }

    private String nextRoomColor(long clinicId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM clinic_rooms WHERE clinicId = ?", Integer.class, clinicId);
        int index = count == null ? 0 : count;
        return DEFAULT_ROOM_COLORS[index % DEFAULT_ROOM_COLORS.length];
    }

    private static String requireName(String value, String message) {
        String name = blankToNull(value);
        if (name == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return name;
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String normalizeColor(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String color = value.trim();
        if (color.matches("#[0-9A-Fa-f]{6}")) {
            return color;
        }
        return fallback;
    }
}
