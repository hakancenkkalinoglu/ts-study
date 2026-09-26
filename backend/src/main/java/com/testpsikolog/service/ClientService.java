package com.testpsikolog.service;

import com.testpsikolog.dto.ClientResponse;
import com.testpsikolog.dto.ClientRiskResponse;
import com.testpsikolog.dto.CreateClientRequest;
import com.testpsikolog.dto.UpdateClientRequest;
import com.testpsikolog.dto.UpdateClientRiskRequest;
import com.testpsikolog.util.AttachmentFiles;
import com.testpsikolog.util.AuditColumns;
import com.testpsikolog.util.ScheduleInputs;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClientService {

    private static final String CLIENT_COLUMNS =
            "id, email, name, birthDate, agreedFee, phone, emergencyName, emergencyPhone, createdAt, updatedAt, clinicId, "
                    + AuditColumns.names("clients");

    private static final RowMapper<ClientResponse> CLIENT_MAPPER = (rs, rowNum) -> new ClientResponse(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("name"),
            rs.getString("birthDate"),
            rs.getObject("agreedFee") == null ? null : rs.getInt("agreedFee"),
            rs.getString("phone"),
            rs.getString("emergencyName"),
            rs.getString("emergencyPhone"),
            rs.getString("createdAt"),
            rs.getString("updatedAt"),
            rs.getString("createdByName"),
            rs.getString("updatedByName"),
            rs.getObject("clinicId") == null ? null : rs.getLong("clinicId")
    );

    private static final Set<String> RISK_LEVELS = Set.of("low", "medium", "high");
    private static final int RISK_NOTE_MAX = 500;

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final ClinicService clinicService;

    public ClientService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, ClinicService clinicService) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.clinicService = clinicService;
    }

    /** Danışanın kliniği (null = kişisel). Randevunun kliniği buradan gelir. */
    public Long clinicIdOf(long clientId) {
        return jdbc.query(
                "SELECT clinicId FROM clients WHERE id = ?",
                rs -> rs.next() && rs.getObject("clinicId") != null ? rs.getLong("clinicId") : null,
                clientId
        );
    }

    /**
     * Danışanın klinik seçimi: 0 = kişisel; verilmişse psikolog o kliniğin üyesi olmalı; boşsa kliniği yoksa
     * kişisel, tek kliniği varsa o, birden fazlaysa 400 (danışan için klinik seçilmeli).
     */
    private Long resolveClientClinic(long userId, Long requested) {
        if (requested != null && requested == 0L) {
            return null;
        }
        if (requested == null && clinicService.clinicIdsForUser(userId).size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danışan için klinik seçin.");
        }
        return clinicService.resolveClinicId(userId, requested);
    }

    public List<ClientResponse> getAll(long userId, String search) {
        if (search != null && !search.trim().isEmpty()) {
            String pattern = "%" + search.trim() + "%";
            return jdbc.query(
                    "SELECT " + CLIENT_COLUMNS
                            + " FROM clients WHERE userId = ? AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR emergencyPhone ILIKE ? OR emergencyName ILIKE ?) ORDER BY name ASC",
                    CLIENT_MAPPER,
                    userId,
                    pattern,
                    pattern,
                    pattern,
                    pattern,
                    pattern
            );
        }
        return jdbc.query(
                "SELECT " + CLIENT_COLUMNS + " FROM clients WHERE userId = ? ORDER BY name ASC",
                CLIENT_MAPPER,
                userId
        );
    }

    public ClientResponse getById(long userId, long id) {
        List<ClientResponse> rows = jdbc.query(
                "SELECT " + CLIENT_COLUMNS + " FROM clients WHERE id = ? AND userId = ?",
                CLIENT_MAPPER,
                id,
                userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public long create(long userId, CreateClientRequest request) {
        String name = requireName(request.name());
        String email = normalizeOptionalEmail(request.email());
        Long clinicId = resolveClientClinic(userId, request.clinicId());
        assertEmailAvailable(userId, clinicId, email, null);
        String hashed = null;
        if (request.password() != null && !request.password().isBlank()) {
            hashed = passwordEncoder.encode(request.password());
        }
        Integer requestedFee = ScheduleInputs.requireNonNegativeFee(request.agreedFee());
        int agreedFee = requestedFee == null ? 2000 : requestedFee;
        Long id = jdbc.queryForObject(
                """
                INSERT INTO clients (email, name, birthDate, agreedFee, password, userId, phone, emergencyName, emergencyPhone, createdAt, updatedAt, createdBy, updatedBy, clinicId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, utc_now_text(), utc_now_text(), ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                email,
                name,
                blankToNull(request.birthDate()),
                agreedFee,
                hashed,
                userId,
                blankToNull(request.phone()),
                blankToNull(request.emergencyName()),
                blankToNull(request.emergencyPhone()),
                userId,
                userId,
                clinicId
        );
        return id == null ? 0L : id;
    }

    @Transactional
    public int update(long userId, long id, UpdateClientRequest data) {
        if (!ownsClient(userId, id)) {
            return 0;
        }
        ScheduleInputs.requireNonNegativeFee(data.agreedFee());
        String name = data.name() == null ? null : requireName(data.name());
        Long currentClinic = clinicIdOf(id);
        boolean clinicChange = false;
        Long newClinic = currentClinic;
        if (data.clinicId() != null) {
            newClinic = data.clinicId() == 0L ? null : clinicService.resolveClinicId(userId, data.clinicId());
            clinicChange = !java.util.Objects.equals(newClinic, currentClinic);
        }
        boolean emailProvided = data.email() != null;
        String email = emailProvided ? normalizeOptionalEmail(data.email()) : null;
        if (emailProvided) {
            assertEmailAvailable(userId, newClinic, email, id);
        } else if (clinicChange) {
            String stored = jdbc.query("SELECT email FROM clients WHERE id = ?", rs -> rs.next() ? rs.getString("email") : null, id);
            assertEmailAvailable(userId, newClinic, stored == null ? null : stored.toLowerCase(Locale.ROOT), id);
        }
        String hashed = null;
        if (data.password() != null && !data.password().isBlank()) {
            hashed = passwordEncoder.encode(data.password());
        }
        if (clinicChange) {
            moveClientToClinic(id, newClinic);
        }
        return jdbc.update(
                """
                UPDATE clients
                SET
                  email = CASE WHEN ? = 1 THEN ? ELSE email END,
                  name = COALESCE(?, name),
                  birthDate = CASE WHEN ? = 1 THEN ? ELSE birthDate END,
                  agreedFee = CASE WHEN CAST(? AS INTEGER) IS NOT NULL THEN ? ELSE agreedFee END,
                  password = COALESCE(?, password),
                  phone = COALESCE(?, phone),
                  emergencyName = COALESCE(?, emergencyName),
                  emergencyPhone = COALESCE(?, emergencyPhone),
                  updatedAt = utc_now_text(),
                  updatedBy = ?
                WHERE id = ? AND userId = ?
                """,
                emailProvided ? 1 : 0,
                email,
                name,
                data.birthDate() != null ? 1 : 0,
                data.birthDate() == null ? null : blankToNull(data.birthDate()),
                data.agreedFee(),
                data.agreedFee(),
                hashed,
                trimPresent(data.phone()),
                trimPresent(data.emergencyName()),
                trimPresent(data.emergencyPhone()),
                userId,
                id,
                userId
        );
    }

    /**
     * Danışanın kliniğini değiştirir. Gelecekteki randevular yeni kliniğe geçer ve yeni klinikte olmayan odadan
     * çıkar; geçmiş randevular eski klinik etiketini korur (raporlar bozulmasın).
     */
    private void moveClientToClinic(long clientId, Long newClinic) {
        jdbc.update("UPDATE clients SET clinicId = ? WHERE id = ?", newClinic, clientId);
        jdbc.update(
                """
                UPDATE appointments
                SET clinicId = ?,
                    roomId = CASE WHEN roomId IN (SELECT id FROM clinic_rooms WHERE clinicId = ?) THEN roomId ELSE NULL END,
                    updatedAt = utc_now_text()
                WHERE clientId = ?
                  AND appointmentDate >= to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD')
                """,
                newClinic,
                newClinic,
                clientId
        );
    }

    /** Danışanın psikoloğu dışında kimse okuyamaz: danışan yoksa veya başkasınınsa null döner. */
    public ClientRiskResponse getRisk(long userId, long clientId) {
        List<ClientRiskResponse> rows = jdbc.query(
                "SELECT riskLevel, riskNote, riskUpdatedAt FROM clients WHERE id = ? AND userId = ?",
                (rs, rowNum) -> new ClientRiskResponse(
                        rs.getString("riskLevel"),
                        rs.getString("riskNote"),
                        rs.getString("riskUpdatedAt")
                ),
                clientId,
                userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Seviye boş gönderilirse işaret kaldırılır (not da silinir). */
    public int setRisk(long userId, long clientId, UpdateClientRiskRequest data) {
        String level = data.level() == null ? "" : data.level().trim().toLowerCase(Locale.ROOT);
        if (level.isEmpty()) {
            return jdbc.update(
                    "UPDATE clients SET riskLevel = NULL, riskNote = NULL, riskUpdatedAt = NULL WHERE id = ? AND userId = ?",
                    clientId,
                    userId
            );
        }
        if (!RISK_LEVELS.contains(level)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Risk seviyesi geçerli değil.");
        }
        String note = blankToNull(data.note());
        if (note != null && note.length() > RISK_NOTE_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Risk notu en fazla " + RISK_NOTE_MAX + " karakter olabilir.");
        }
        return jdbc.update(
                "UPDATE clients SET riskLevel = ?, riskNote = ?, riskUpdatedAt = utc_now_text() WHERE id = ? AND userId = ?",
                level,
                note,
                clientId,
                userId
        );
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ad soyad zorunludur.");
        }
        return name.trim();
    }

    private static String normalizeOptionalEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (!normalized.contains("@") || normalized.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-posta geçerli değil.");
        }
        return normalized;
    }

    /** E-posta psikolog ve klinik bazında tektir: aynı kişi iki klinikte (ya da kişisel) ayrı kayıt olabilir. */
    private void assertEmailAvailable(long userId, Long clinicId, String email, Long excludeClientId) {
        if (email == null) {
            return;
        }
        Long found;
        if (excludeClientId == null) {
            found = jdbc.query(
                    "SELECT id FROM clients WHERE userId = ? AND COALESCE(clinicId, 0) = ? AND lower(email) = ? LIMIT 1",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    userId,
                    clinicId == null ? 0L : clinicId,
                    email
            );
        } else {
            found = jdbc.query(
                    "SELECT id FROM clients WHERE userId = ? AND COALESCE(clinicId, 0) = ? AND lower(email) = ? AND id <> ? LIMIT 1",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    userId,
                    clinicId == null ? 0L : clinicId,
                    email,
                    excludeClientId
            );
        }
        if (found != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu e-posta ile kayıtlı bir danışanınız zaten var.");
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String trimPresent(String value) {
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    @Transactional
    public int delete(long userId, long id) {
        if (!ownsClient(userId, id)) {
            return 0;
        }
        List<String> attachmentPaths = jdbc.query(
                "SELECT filePath FROM client_notes WHERE clientId = ? AND filePath IS NOT NULL AND filePath <> ''",
                (rs, rowNum) -> rs.getString("filePath"),
                id
        );
        jdbc.update("DELETE FROM client_notes WHERE clientId = ?", id);
        jdbc.update("DELETE FROM appointments WHERE clientId = ?", id);
        jdbc.update("DELETE FROM session_packages WHERE clientId = ?", id);
        jdbc.update("DELETE FROM client_inventory_results WHERE clientId = ?", id);
        int deleted = jdbc.update("DELETE FROM clients WHERE id = ? AND userId = ?", id, userId);
        AttachmentFiles.deleteQuietly(attachmentPaths);
        return deleted;
    }

    public void requireOwned(long userId, long clientId) {
        if (!ownsClient(userId, clientId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Danışan bulunamadı.");
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
