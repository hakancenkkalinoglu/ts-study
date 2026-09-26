package com.testpsikolog.service;

import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.AcceptInvitationRequest;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.CreateInvitationRequest;
import com.testpsikolog.dto.InvitationPreviewResponse;
import com.testpsikolog.dto.InvitationResponse;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.security.AuthUser;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * E-postaya bağlı, tek kullanımlık klinik davetleri. Token yalnızca oluşturulurken görülür;
 * veritabanında SHA-256 özeti saklanır. Şu an e-posta gönderilmiyor, bağlantı sahibe döner.
 */
@Service
public class InvitationService {

    private static final Duration VALIDITY = Duration.ofDays(7);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String INVALID = "Davet bulunamadı veya süresi doldu.";

    private static final RowMapper<InvitationResponse> LIST_MAPPER = (rs, rowNum) -> new InvitationResponse(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getLong("expiresAt"),
            null
    );

    private final JdbcTemplate jdbc;
    private final ClinicService clinicService;
    private final AuthService authService;
    private final AppProperties appProperties;

    public InvitationService(
            JdbcTemplate jdbc,
            ClinicService clinicService,
            AuthService authService,
            AppProperties appProperties
    ) {
        this.jdbc = jdbc;
        this.clinicService = clinicService;
        this.authService = authService;
        this.appProperties = appProperties;
    }

    @Transactional
    public InvitationResponse create(long userId, Long clinicId, CreateInvitationRequest request) {
        ClinicResponse clinic = clinicService.requirePermission(userId, clinicId, ClinicPermission.INVITE_MEMBERS);
        String email = request == null || request.email() == null ? "" : request.email().trim().toLowerCase(Locale.ROOT);
        if (email.isBlank() || !email.contains("@") || email.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir e-posta girin.");
        }
        AuthUser existing = authService.findByLogin(email);
        if (existing != null && existing.id() != null && clinicService.isMember(clinic.id(), existing.id())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu kişi zaten bu kliniğin üyesi.");
        }
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        long expiresAt = Instant.now().plus(VALIDITY).toEpochMilli();

        jdbc.update("DELETE FROM clinic_invitations WHERE clinicId = ? AND email = ?", clinic.id(), email);
        Long id = jdbc.queryForObject(
                """
                INSERT INTO clinic_invitations (clinicId, email, tokenHash, invitedBy, expiresAt, createdAt)
                VALUES (?, ?, ?, ?, ?, utc_now_text()) RETURNING id
                """,
                Long.class,
                clinic.id(),
                email,
                hash(token),
                userId,
                expiresAt
        );
        String base = appProperties.getFrontendUrl().replaceAll("/+$", "");
        return new InvitationResponse(id == null ? 0L : id, email, expiresAt, base + "/invite/" + token);
    }

    public List<InvitationResponse> list(long userId, Long clinicId) {
        ClinicResponse clinic = clinicService.requirePermission(userId, clinicId, ClinicPermission.INVITE_MEMBERS);
        return jdbc.query(
                "SELECT id, email, expiresAt FROM clinic_invitations WHERE clinicId = ? AND expiresAt >= ? ORDER BY id DESC",
                LIST_MAPPER,
                clinic.id(),
                System.currentTimeMillis()
        );
    }

    public void revoke(long userId, Long clinicId, long invitationId) {
        ClinicResponse clinic = clinicService.requirePermission(userId, clinicId, ClinicPermission.INVITE_MEMBERS);
        int deleted = jdbc.update(
                "DELETE FROM clinic_invitations WHERE id = ? AND clinicId = ?",
                invitationId,
                clinic.id()
        );
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Davet bulunamadı.");
        }
    }

    public InvitationPreviewResponse preview(String token) {
        Invitation invitation = requireInvitation(token);
        AuthUser existing = authService.findByLogin(invitation.email());
        return new InvitationPreviewResponse(
                invitation.clinicName(),
                invitation.email(),
                existing != null && existing.id() != null
        );
    }

    @Transactional
    public LoginResponse accept(String token, AcceptInvitationRequest request) {
        Invitation invitation = requireInvitation(token);
        if (request == null || request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Şifre gerekli.");
        }
        AuthUser existing = authService.findByLogin(invitation.email());
        LoginResponse login;
        if (existing != null && existing.id() != null) {
            login = authService.login(new LoginRequest(invitation.email(), null, request.password(), null));
        } else {
            login = authService.register(
                    new LoginRequest(invitation.email(), null, request.password(), request.displayName())
            );
        }
        AuthUser user = authService.findByLogin(invitation.email());
        if (user == null || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Hesap oluşturulamadı.");
        }
        clinicService.addMember(invitation.clinicId(), user.id());
        jdbc.update("DELETE FROM clinic_invitations WHERE id = ?", invitation.id());
        return login;
    }

    private Invitation requireInvitation(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, INVALID);
        }
        List<Invitation> found = jdbc.query(
                """
                SELECT i.id, i.clinicId, i.email, c.name AS clinicName
                FROM clinic_invitations i
                INNER JOIN clinics c ON c.id = i.clinicId
                WHERE i.tokenHash = ? AND i.expiresAt >= ?
                """,
                (rs, rowNum) -> new Invitation(
                        rs.getLong("id"),
                        rs.getLong("clinicId"),
                        rs.getString("email"),
                        rs.getString("clinicName")
                ),
                hash(token.trim()),
                System.currentTimeMillis()
        );
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, INVALID);
        }
        return found.get(0);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private record Invitation(long id, long clinicId, String email, String clinicName) {
    }
}
