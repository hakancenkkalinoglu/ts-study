package com.testpsikolog.service;

import com.testpsikolog.dto.ClinicMemberResponse;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.ClinicRoomResponse;
import com.testpsikolog.dto.CreateClinicRequest;
import com.testpsikolog.dto.CreateRoomRequest;
import com.testpsikolog.dto.JoinClinicRequest;
import com.testpsikolog.dto.TransferOwnerRequest;
import com.testpsikolog.dto.UpdateClinicRequest;
import com.testpsikolog.dto.UpdateRoomRequest;
import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClinicService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String[] DEFAULT_ROOM_COLORS = {"#8b5e3c", "#3f7f6e", "#a86a2f", "#6d5a8c"};
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

    /**
     * Kullanıcının tek klinik bağlamı. {@code clinicId} verilmişse üyelik doğrulanır (üye değilse 404, başka
     * kliniğin varlığı sızmaz). Verilmemişse: kliniği yoksa null, tek kliniği varsa o, birden fazlaysa 400.
     * Böylece tek klinikli kullanıcılar parametre göndermeden eskisi gibi çalışır.
     */
    public Long resolveClinicId(long userId, Long clinicId) {
        if (clinicId != null && clinicId != 0L) {
            if (!isMember(clinicId, userId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
            }
            return clinicId;
        }
        List<Long> ids = clinicIdsForUser(userId);
        if (ids.isEmpty()) {
            return null;
        }
        if (ids.size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Birden fazla kliniğiniz var, klinik seçin.");
        }
        return ids.get(0);
    }

    public List<Long> clinicIdsForUser(long userId) {
        return jdbc.query(
                "SELECT clinicId FROM clinic_members WHERE userId = ? ORDER BY clinicId ASC",
                (rs, rowNum) -> rs.getLong("clinicId"),
                userId
        );
    }

    public boolean isMember(long clinicId, long userId) {
        Integer found = jdbc.query(
                "SELECT 1 FROM clinic_members WHERE clinicId = ? AND userId = ?",
                rs -> rs.next() ? 1 : null,
                clinicId,
                userId
        );
        return found != null;
    }

    public ClinicResponse getMine(long userId, Long clinicId) {
        Long resolved = resolveClinicId(userId, clinicId);
        if (resolved == null) {
            return null;
        }
        return loadClinic(resolved, userId);
    }

    /** Kullanıcının üye olduğu tüm klinikler (klinik seçici için). */
    public List<ClinicResponse> listMine(long userId) {
        List<ClinicResponse> result = new java.util.ArrayList<>();
        for (Long id : clinicIdsForUser(userId)) {
            ClinicResponse clinic = loadClinic(id, userId);
            if (clinic != null) {
                result.add(clinic);
            }
        }
        return result;
    }

    /** Odanın {@code clinicId} kliniğine ait olduğunu doğrular; başka klinikteki oda seçilemez. */
    public ClinicRoomResponse requireRoomInClinic(Long clinicId, Long roomId) {
        if (roomId == null) {
            return null;
        }
        if (clinicId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu danışan bir kliniğe bağlı değil, oda seçilemez.");
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

    @Transactional
    public ClinicResponse create(long userId, CreateClinicRequest request) {
        String name = requireName(request == null ? null : request.name(), "Klinik adı gerekli.");
        String code = newInviteCode();
        Long clinicId = jdbc.queryForObject(
                "INSERT INTO clinics (name, inviteCode, ownerUserId, createdAt) VALUES (?, ?, ?, utc_now_text()) RETURNING id",
                Long.class,
                name,
                code,
                userId
        );
        if (clinicId == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Klinik oluşturulamadı.");
        }
        jdbc.update(
                "INSERT INTO clinic_members (clinicId, userId, role, createdAt) VALUES (?, ?, 'owner', utc_now_text())",
                clinicId,
                userId
        );
        jdbc.update(
                "INSERT INTO clinic_rooms (clinicId, name, color, createdAt) VALUES (?, 'Oda 1', ?, utc_now_text())",
                clinicId,
                DEFAULT_ROOM_COLORS[0]
        );
        jdbc.update(
                "INSERT INTO clinic_rooms (clinicId, name, color, createdAt) VALUES (?, 'Online', ?, utc_now_text())",
                clinicId,
                DEFAULT_ROOM_COLORS[1]
        );
        return loadClinic(clinicId, userId);
    }

    @Transactional
    public ClinicResponse join(long userId, JoinClinicRequest request) {
        String code = request == null || request.inviteCode() == null ? "" : request.inviteCode().trim().toUpperCase(Locale.ROOT);
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
        addMember(clinicId, userId);
        return loadClinic(clinicId, userId);
    }

    public void addMember(long clinicId, long userId) {
        if (isMember(clinicId, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Zaten bu kliniğin üyesisiniz.");
        }
        jdbc.update(
                "INSERT INTO clinic_members (clinicId, userId, role, createdAt) VALUES (?, ?, 'member', utc_now_text())",
                clinicId,
                userId
        );
    }

    @Transactional
    public void leave(long userId, Long clinicId) {
        ClinicResponse clinic = getMine(userId, clinicId);
        if (clinic == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
        }
        if ("owner".equals(clinic.role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kurucu ayrılamaz. Önce sahipliği devredin veya kliniği silin.");
        }
        jdbc.update("DELETE FROM clinic_members WHERE clinicId = ? AND userId = ?", clinic.id(), userId);
        releaseFutureRooms(clinic.id(), userId);
    }

    /**
     * Üyelik biterken (K6, Karar 7): gelecekteki randevular klinikten ve odadan çıkar, psikoloğun bu klinikteki
     * danışanları kişisel olur (psikologda kalır). Geçmiş randevular klinik etiketini korur, raporlar bozulmaz.
     */
    private void releaseFutureRooms(long clinicId, long memberUserId) {
        jdbc.update(
                """
                UPDATE appointments
                SET roomId = NULL, clinicId = NULL, updatedAt = utc_now_text()
                WHERE (clinicId = ? OR roomId IN (SELECT id FROM clinic_rooms WHERE clinicId = ?))
                  AND appointmentDate >= to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD')
                  AND clientId IN (SELECT id FROM clients WHERE userId = ?)
                """,
                clinicId,
                clinicId,
                memberUserId
        );
        jdbc.update("UPDATE clients SET clinicId = NULL WHERE clinicId = ? AND userId = ?", clinicId, memberUserId);
    }

    @Transactional
    public void deleteClinic(long userId, Long clinicId) {
        ClinicResponse clinic = getMine(userId, clinicId);
        if (clinic == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
        }
        if (!ClinicPermission.forRole(clinic.role()).contains(ClinicPermission.MANAGE_CLINIC)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Kliniği sadece kurucu silebilir.");
        }
        jdbc.update("UPDATE appointments SET clinicId = NULL, roomId = NULL WHERE clinicId = ?", clinic.id());
        jdbc.update("UPDATE clients SET clinicId = NULL WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinic_rooms WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM commission_rates WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinic_share_payments WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinic_invitations WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinic_members WHERE clinicId = ?", clinic.id());
        jdbc.update("DELETE FROM clinics WHERE id = ?", clinic.id());
    }

    public ClinicRoomResponse addRoom(long userId, Long requestedClinicId, CreateRoomRequest request) {
        long clinicId = requirePermission(userId, requestedClinicId, ClinicPermission.MANAGE_ROOMS).id();
        String name = requireName(request == null ? null : request.name(), "Oda adı gerekli.");
        String color = normalizeColor(request == null ? null : request.color(), nextRoomColor(clinicId));
        Long id = jdbc.queryForObject(
                "INSERT INTO clinic_rooms (clinicId, name, color, createdAt) VALUES (?, ?, ?, utc_now_text()) RETURNING id",
                Long.class,
                clinicId,
                name,
                color
        );
        return new ClinicRoomResponse(id == null ? 0L : id, name, color);
    }

    public ClinicRoomResponse updateRoom(long userId, Long clinicId, long roomId, UpdateRoomRequest request) {
        long resolved = requirePermission(userId, clinicId, ClinicPermission.MANAGE_ROOMS).id();
        requireRoomInClinic(resolved, roomId);
        String name = request == null ? null : blankToNull(request.name());
        String color = request == null ? null : blankToNull(request.color());
        if (name == null && color == null) {
            return requireRoomInClinic(resolved, roomId);
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
        return requireRoomInClinic(resolved, roomId);
    }

    @Transactional
    public void deleteRoom(long userId, Long clinicId, long roomId) {
        long resolved = requirePermission(userId, clinicId, ClinicPermission.MANAGE_ROOMS).id();
        requireRoomInClinic(resolved, roomId);
        jdbc.update("UPDATE appointments SET roomId = NULL WHERE roomId = ?", roomId);
        jdbc.update("DELETE FROM clinic_rooms WHERE id = ?", roomId);
    }

    public List<ClinicRoomResponse> listRooms(long userId, Long requestedClinicId) {
        Long clinicId = resolveClinicId(userId, requestedClinicId);
        if (clinicId == null) {
            return List.of();
        }
        return jdbc.query(
                "SELECT id, name, color FROM clinic_rooms WHERE clinicId = ? ORDER BY id ASC",
                ROOM_MAPPER,
                clinicId
        );
    }

    public ClinicResponse rename(long userId, Long clinicId, UpdateClinicRequest request) {
        ClinicResponse clinic = requirePermission(userId, clinicId, ClinicPermission.MANAGE_CLINIC);
        String name = requireName(request == null ? null : request.name(), "Klinik adı gerekli.");
        jdbc.update("UPDATE clinics SET name = ? WHERE id = ?", name, clinic.id());
        return loadClinic(clinic.id(), userId);
    }

    public ClinicResponse rotateInvite(long userId, Long clinicId) {
        ClinicResponse clinic = requirePermission(userId, clinicId, ClinicPermission.INVITE_MEMBERS);
        String code = newInviteCode();
        jdbc.update("UPDATE clinics SET inviteCode = ? WHERE id = ?", code, clinic.id());
        return loadClinic(clinic.id(), userId);
    }

    @Transactional
    public ClinicResponse kickMember(long userId, Long clinicId, long memberUserId) {
        ClinicResponse clinic = requirePermission(userId, clinicId, ClinicPermission.MANAGE_MEMBERS);
        if (memberUserId == userId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kendinizi çıkaramazsınız.");
        }
        int deleted = jdbc.update(
                "DELETE FROM clinic_members WHERE clinicId = ? AND userId = ? AND role != 'owner'",
                clinic.id(),
                memberUserId
        );
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Üye bulunamadı.");
        }
        releaseFutureRooms(clinic.id(), memberUserId);
        return loadClinic(clinic.id(), userId);
    }

    @Transactional
    public ClinicResponse transferOwnership(long userId, Long clinicId, TransferOwnerRequest request) {
        ClinicResponse clinic = requirePermission(userId, clinicId, ClinicPermission.MANAGE_CLINIC);
        Long nextOwnerId = request == null ? null : request.userId();
        if (nextOwnerId == null || nextOwnerId == userId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sahipliği başka bir üyeye devredin.");
        }
        Integer member = jdbc.query(
                "SELECT userId FROM clinic_members WHERE clinicId = ? AND userId = ?",
                rs -> rs.next() ? 1 : null,
                clinic.id(),
                nextOwnerId
        );
        if (member == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu kişi klinikte üye değil.");
        }
        jdbc.update("UPDATE clinic_members SET role = 'member' WHERE clinicId = ? AND userId = ?", clinic.id(), userId);
        jdbc.update("UPDATE clinic_members SET role = 'owner' WHERE clinicId = ? AND userId = ?", clinic.id(), nextOwnerId);
        jdbc.update("UPDATE clinics SET ownerUserId = ? WHERE id = ?", nextOwnerId, clinic.id());
        return loadClinic(clinic.id(), userId);
    }

    public ClinicResponse requirePermission(long userId, Long clinicId, ClinicPermission permission) {
        ClinicResponse clinic = getMine(userId, clinicId);
        if (clinic == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Klinik bulunamadı.");
        }
        if (!ClinicPermission.forRole(clinic.role()).contains(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu işlem için yetkiniz yok.");
        }
        return clinic;
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
                SELECT m.userId, m.role, COALESCE(NULLIF(u.displayName, ''), NULLIF(u.email, ''), u.username) AS name
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
                rooms,
                ClinicPermission.namesForRole(role)
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
